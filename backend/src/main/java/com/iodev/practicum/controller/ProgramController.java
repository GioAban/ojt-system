package com.iodev.practicum.controller;

import com.iodev.practicum.dto.ProgramRequest;
import com.iodev.practicum.dto.ProgramResponse;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.repository.CollegeRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.ProgramRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/programs")
public class ProgramController {

    private static final BigDecimal MAX_HOURS = new BigDecimal("5000");

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private CollegeRepository collegeRepository;

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @GetMapping
    public List<ProgramResponse> getAll() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : coordinatorRepository.countActiveByProgram()) {
            counts.put((Long) row[0], (Long) row[1]);
        }

        return programRepository.findAll(Sort.by("college.name", "name")).stream()
                .map(p -> toResponse(p, counts.getOrDefault(p.getId(), 0L)))
                .toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody ProgramRequest request) {
        String error = validate(request);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        College college = collegeRepository.findById(request.getCollegeId()).orElse(null);
        if (college == null) {
            return ResponseEntity.badRequest().body("Selected college was not found.");
        }
        if (Boolean.TRUE.equals(college.getIsArchived())) {
            return ResponseEntity.badRequest()
                    .body("Archived colleges can't receive new programs. Restore the college first.");
        }

        String name = clean(request.getName());
        String abbreviation = clean(request.getAbbreviation()).toUpperCase();

        if (programRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.status(409).body("A program with that name already exists.");
        }
        if (programRepository.existsByAbbreviationIgnoreCase(abbreviation)) {
            return ResponseEntity.status(409).body("A program with that abbreviation already exists.");
        }

        Program program = new Program();
        program.setCollege(college);
        program.setName(name);
        program.setAbbreviation(abbreviation);
        program.setProgramHead(clean(request.getProgramHead()));
        program.setTrainingDuration(request.getTrainingDuration().setScale(2, RoundingMode.HALF_UP));
        program.setIsArchived(false);

        return ResponseEntity.ok(toResponse(programRepository.save(program), 0L));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody ProgramRequest request) {
        Program program = programRepository.findById(id).orElse(null);
        if (program == null) {
            return ResponseEntity.notFound().build();
        }

        String error = validate(request);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        College college = collegeRepository.findById(request.getCollegeId()).orElse(null);
        if (college == null) {
            return ResponseEntity.badRequest().body("Selected college was not found.");
        }

        boolean collegeChanged = !college.getId().equals(program.getCollege().getId());
        if (collegeChanged && Boolean.TRUE.equals(college.getIsArchived())) {
            return ResponseEntity.badRequest()
                    .body("You can't move a program into an archived college.");
        }

        String name = clean(request.getName());
        String abbreviation = clean(request.getAbbreviation()).toUpperCase();

        if (programRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            return ResponseEntity.status(409).body("A program with that name already exists.");
        }
        if (programRepository.existsByAbbreviationIgnoreCaseAndIdNot(abbreviation, id)) {
            return ResponseEntity.status(409).body("A program with that abbreviation already exists.");
        }

        program.setCollege(college);
        program.setName(name);
        program.setAbbreviation(abbreviation);
        program.setProgramHead(clean(request.getProgramHead()));
        program.setTrainingDuration(request.getTrainingDuration().setScale(2, RoundingMode.HALF_UP));

        return ResponseEntity.ok(toResponse(
                programRepository.save(program),
                coordinatorRepository.countActiveByProgramId(id)));
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archive(@PathVariable Long id) {
        Program program = programRepository.findById(id).orElse(null);
        if (program == null) {
            return ResponseEntity.notFound().build();
        }

        long activeCoordinators = coordinatorRepository.countActiveByProgramId(id);
        if (activeCoordinators > 0) {
            return ResponseEntity.badRequest().body(
                    "This program still has " + activeCoordinators
                            + " active coordinator(s). Archive or reassign them first.");
        }

        program.setIsArchived(true);
        return ResponseEntity.ok(toResponse(programRepository.save(program), 0L));
    }

    @PatchMapping("/{id}/restore")
    @Transactional
    public ResponseEntity<?> restore(@PathVariable Long id) {
        Program program = programRepository.findById(id).orElse(null);
        if (program == null) {
            return ResponseEntity.notFound().build();
        }

        College college = program.getCollege();
        if (Boolean.TRUE.equals(college.getIsArchived())) {
            return ResponseEntity.badRequest()
                    .body("Restore the college (" + college.getAbbreviation() + ") first.");
        }

        program.setIsArchived(false);
        return ResponseEntity.ok(toResponse(
                programRepository.save(program),
                coordinatorRepository.countActiveByProgramId(id)));
    }

    private ProgramResponse toResponse(Program p, long coordinatorsCount) {
        College c = p.getCollege();
        return new ProgramResponse(
                p.getId(), c.getId(), c.getName(), c.getAbbreviation(), c.getIsArchived(),
                p.getName(), p.getAbbreviation(), p.getTrainingDuration(), p.getProgramHead(),
                p.getIsArchived(), coordinatorsCount, p.getCreatedAt(), p.getUpdatedAt());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String validate(ProgramRequest request) {
        if (request == null) return "Request body is required.";
        if (request.getCollegeId() == null) return "Please select a college.";

        String name = clean(request.getName());
        String abbreviation = clean(request.getAbbreviation());
        String head = clean(request.getProgramHead());
        BigDecimal hours = request.getTrainingDuration();

        if (name.isEmpty()) return "Program name is required.";
        if (name.length() > 255) return "Program name is too long (max 255 characters).";
        if (abbreviation.isEmpty()) return "Abbreviation is required.";
        if (abbreviation.length() > 20) return "Abbreviation is too long (max 20 characters).";
        if (head.isEmpty()) return "Program head is required.";
        if (head.length() > 45) return "Program head name is too long (max 45 characters).";
        if (hours == null) return "Training duration is required.";
        if (hours.compareTo(BigDecimal.ZERO) <= 0) return "Training duration must be greater than 0.";
        if (hours.compareTo(MAX_HOURS) > 0) return "Training duration can't exceed 5000 hours.";
        return null;
    }
}