package com.iodev.practicum.controller;

import com.iodev.practicum.dto.CoordinatorRequest;
import com.iodev.practicum.dto.CoordinatorResponse;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorType;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Role;
import com.iodev.practicum.model.User;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DirectorRepository;
import com.iodev.practicum.repository.ProgramRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/coordinators")
public class CoordinatorController {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DirectorRepository directorRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping
    public List<CoordinatorResponse> getAll() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : studentRepository.countActiveByCoordinator()) {
            counts.put((Long) row[0], (Long) row[1]);
        }

        return coordinatorRepository.findAll(Sort.by("user.fullname")).stream()
                .map(c -> toResponse(c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody CoordinatorRequest request) {
        String error = validate(request, true);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        String email = clean(request.getEmail()).toLowerCase();
        String employeeNumber = clean(request.getEmployeeNumber());

        if (emailTaken(email, null)) {
            return ResponseEntity.status(409).body("That email is already used by another account.");
        }
        if (coordinatorRepository.existsByEmployeeNumberIgnoreCase(employeeNumber)) {
            return ResponseEntity.status(409).body("That employee number already exists.");
        }

        Program program = programRepository.findById(request.getProgramId()).orElse(null);
        if (program == null) {
            return ResponseEntity.badRequest().body("Selected program was not found.");
        }
        if (Boolean.TRUE.equals(program.getIsArchived())) {
            return ResponseEntity.badRequest()
                    .body("Archived programs can't receive new coordinators. Restore the program first.");
        }

        User user = new User();
        user.setFullname(clean(request.getFullname()));
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoleAs(Role.COORDINATOR);
        user.setIsArchived(false);
        userRepository.save(user);

        Coordinator coordinator = new Coordinator();
        coordinator.setUser(user);
        coordinator.setProgram(program);
        coordinator.setType(parseType(request.getType()));
        coordinator.setEmployeeNumber(employeeNumber);
        coordinator.setProfessionalTitles(emptyToNull(clean(request.getProfessionalTitles())));

        return ResponseEntity.ok(toResponse(coordinatorRepository.save(coordinator), 0L));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody CoordinatorRequest request) {
        Coordinator coordinator = coordinatorRepository.findById(id).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.notFound().build();
        }

        String error = validate(request, false);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        User user = coordinator.getUser();
        String email = clean(request.getEmail()).toLowerCase();
        String employeeNumber = clean(request.getEmployeeNumber());

        if (emailTaken(email, user.getId())) {
            return ResponseEntity.status(409).body("That email is already used by another account.");
        }
        if (coordinatorRepository.existsByEmployeeNumberIgnoreCaseAndIdNot(employeeNumber, id)) {
            return ResponseEntity.status(409).body("That employee number already exists.");
        }

        Program program = programRepository.findById(request.getProgramId()).orElse(null);
        if (program == null) {
            return ResponseEntity.badRequest().body("Selected program was not found.");
        }

        boolean programChanged = !program.getId().equals(coordinator.getProgram().getId());
        if (programChanged && Boolean.TRUE.equals(program.getIsArchived())) {
            return ResponseEntity.badRequest().body("You can't move a coordinator into an archived program.");
        }

        user.setFullname(clean(request.getFullname()));
        user.setEmail(email);
        userRepository.save(user);

        coordinator.setProgram(program);
        coordinator.setType(parseType(request.getType()));
        coordinator.setEmployeeNumber(employeeNumber);
        coordinator.setProfessionalTitles(emptyToNull(clean(request.getProfessionalTitles())));

        return ResponseEntity.ok(toResponse(
                coordinatorRepository.save(coordinator),
                studentRepository.countActiveByCoordinatorId(id)));
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archive(@PathVariable Long id) {
        Coordinator coordinator = coordinatorRepository.findById(id).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.notFound().build();
        }

        User user = coordinator.getUser();
        user.setIsArchived(true);
        userRepository.save(user);

        return ResponseEntity.ok(toResponse(coordinator, studentRepository.countActiveByCoordinatorId(id)));
    }

    @PatchMapping("/{id}/restore")
    @Transactional
    public ResponseEntity<?> restore(@PathVariable Long id) {
        Coordinator coordinator = coordinatorRepository.findById(id).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.notFound().build();
        }

        Program program = coordinator.getProgram();
        if (Boolean.TRUE.equals(program.getIsArchived())) {
            return ResponseEntity.badRequest()
                    .body("Restore the program (" + program.getAbbreviation() + ") first.");
        }

        User user = coordinator.getUser();
        user.setIsArchived(false);
        userRepository.save(user);

        return ResponseEntity.ok(toResponse(coordinator, studentRepository.countActiveByCoordinatorId(id)));
    }

    @PatchMapping("/{id}/password")
    @Transactional
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody CoordinatorRequest request) {
        Coordinator coordinator = coordinatorRepository.findById(id).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.notFound().build();
        }

        String error = passwordError(request == null ? null : request.getPassword());
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        User user = coordinator.getUser();
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);

        return ResponseEntity.ok().build();
    }

    private CoordinatorResponse toResponse(Coordinator c, long studentsCount) {
        User u = c.getUser();
        Program p = c.getProgram();
        return new CoordinatorResponse(
                c.getId(), u.getId(), u.getFullname(), u.getEmail(),
                p.getId(), p.getName(), p.getAbbreviation(), p.getIsArchived(),
                p.getCollege().getAbbreviation(), c.getType().name(),
                c.getEmployeeNumber(), c.getProfessionalTitles(),
                u.getIsArchived(), studentsCount, c.getCreatedAt());
    }

    private boolean emailTaken(String email, Long excludeUserId) {
        boolean userTaken = excludeUserId == null
                ? userRepository.existsByEmail(email)
                : userRepository.existsByEmailAndIdNot(email, excludeUserId);
        return userTaken
                || directorRepository.existsByEmail(email)
                || studentRepository.existsByEmail(email);
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String emptyToNull(String value) {
        return value.isEmpty() ? null : value;
    }

    private CoordinatorType parseType(String value) {
        if (value == null) return null;
        try {
            return CoordinatorType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String passwordError(String password) {
        if (password == null || password.length() < 8) {
            return "Password must be at least 8 characters.";
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            return "Password is too long (max 72 characters).";
        }
        return null;
    }

    private String validate(CoordinatorRequest request, boolean creating) {
        if (request == null) return "Request body is required.";

        String fullname = clean(request.getFullname());
        String email = clean(request.getEmail());
        String employeeNumber = clean(request.getEmployeeNumber());
        String titles = clean(request.getProfessionalTitles());

        if (fullname.isEmpty()) return "Full name is required.";
        if (fullname.length() > 100) return "Full name is too long (max 100 characters).";
        if (email.isEmpty()) return "Email is required.";
        if (email.length() > 255 || !EMAIL.matcher(email).matches()) return "Enter a valid email address.";
        if (employeeNumber.isEmpty()) return "Employee number is required.";
        if (employeeNumber.length() > 50) return "Employee number is too long (max 50 characters).";
        if (titles.length() > 255) return "Professional titles are too long (max 255 characters).";
        if (request.getProgramId() == null) return "Please select a program.";
        if (parseType(request.getType()) == null) return "Coordinator type must be ADMIN or STAFF.";

        if (creating) {
            return passwordError(request.getPassword());
        }
        return null;
    }
}