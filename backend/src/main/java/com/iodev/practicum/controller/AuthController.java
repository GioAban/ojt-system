package com.iodev.practicum.controller;

import com.iodev.practicum.dto.*;
import com.iodev.practicum.model.*;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.ProgramRepository;
import com.iodev.practicum.repository.UserRepository;
import com.iodev.practicum.security.JwtUtil;
import com.iodev.practicum.security.LoginIdentifierResolver;
import com.iodev.practicum.service.AccountEmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private LoginIdentifierResolver loginIdentifierResolver;

    @Autowired
    private com.iodev.practicum.service.BuiltInRequirementService builtInRequirements;

    @Autowired
    private AccountEmailService accountEmails;

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        String email = AccountEmailService.normalize(request.getEmail());
        if (email.isEmpty()) {
            return ResponseEntity.badRequest().body("Email is required.");
        }
        if (accountEmails.inUse(email, AccountEmailService.Exclude.NONE)) {
            return ResponseEntity.status(409).body(AccountEmailService.IN_USE);
        }

        Program program = programRepository.findById(request.getProgramId())
                .orElse(null);

        if (program == null) {
            return ResponseEntity.badRequest().body("Invalid program ID.");
        }

        User user = new User();
        user.setFullname(request.getFullname());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoleAs(Role.COORDINATOR);
        user.setIsArchived(false);
        userRepository.save(user);

        Coordinator coordinator = new Coordinator();
        coordinator.setUser(user);
        coordinator.setProgram(program);
        coordinator.setType(CoordinatorType.STAFF);
        coordinator.setEmployeeNumber(request.getEmployeeNumber());
        coordinator.setProfessionalTitles(request.getProfessionalTitles());
        coordinator = coordinatorRepository.save(coordinator);
        builtInRequirements.ensureFor(coordinator);

        String token = jwtUtil.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), user.getFullname(), user.getRoleAs().name(), coordinator.getType().name()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        // Email o Student ID ang inilagay; ginagawang email dito
        String identifier = loginIdentifierResolver.resolveEmail(request.getEmail());
        User user = identifier == null ? null : userRepository.findByEmail(identifier)
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body("Invalid email or password.");
        }

        if (Boolean.TRUE.equals(user.getIsArchived())) {
            return ResponseEntity.status(403).body("This account has been deactivated.");
        }

        String coordinatorType = coordinatorRepository.findByUserId(user.getId())
                .map(c -> c.getType().name())
                .orElse(null);

        String token = jwtUtil.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), user.getFullname(), user.getRoleAs().name(), coordinatorType));
    }
}