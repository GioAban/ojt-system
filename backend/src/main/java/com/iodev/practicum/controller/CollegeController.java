package com.iodev.practicum.controller;

import com.iodev.practicum.dto.CollegeRequest;
import com.iodev.practicum.dto.CollegeResponse;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Director;
import com.iodev.practicum.repository.CollegeRepository;
import com.iodev.practicum.repository.DirectorRepository;
import com.iodev.practicum.repository.ProgramRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/colleges")
public class CollegeController {

    @Autowired
    private CollegeRepository collegeRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private DirectorRepository directorRepository;

    @GetMapping
    public List<CollegeResponse> getAll() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : programRepository.countActiveByCollege()) {
            counts.put((Long) row[0], (Long) row[1]);
        }

        return collegeRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(c -> toResponse(c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody CollegeRequest request, Authentication authentication) {
        String error = validate(request);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        String name = clean(request.getName());
        String abbreviation = clean(request.getAbbreviation()).toUpperCase();
        String dean = clean(request.getDean());

        if (collegeRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.status(409).body("A college with that name already exists.");
        }
        if (collegeRepository.existsByAbbreviationIgnoreCase(abbreviation)) {
            return ResponseEntity.status(409).body("A college with that abbreviation already exists.");
        }

        Director director = directorRepository.findByEmail(authentication.getName()).orElse(null);
        if (director == null) {
            return ResponseEntity.status(403).body("Director account not found.");
        }

        College college = new College();
        college.setDirector(director);
        college.setName(name);
        college.setAbbreviation(abbreviation);
        college.setDean(dean);
        college.setIsArchived(false);

        return ResponseEntity.ok(toResponse(collegeRepository.save(college), 0L));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody CollegeRequest request) {
        College college = collegeRepository.findById(id).orElse(null);
        if (college == null) {
            return ResponseEntity.notFound().build();
        }

        String error = validate(request);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }

        String name = clean(request.getName());
        String abbreviation = clean(request.getAbbreviation()).toUpperCase();
        String dean = clean(request.getDean());

        if (collegeRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            return ResponseEntity.status(409).body("A college with that name already exists.");
        }
        if (collegeRepository.existsByAbbreviationIgnoreCaseAndIdNot(abbreviation, id)) {
            return ResponseEntity.status(409).body("A college with that abbreviation already exists.");
        }

        college.setName(name);
        college.setAbbreviation(abbreviation);
        college.setDean(dean);

        return ResponseEntity.ok(toResponse(
                collegeRepository.save(college),
                programRepository.countActiveByCollegeId(id)));
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archive(@PathVariable Long id) {
        College college = collegeRepository.findById(id).orElse(null);
        if (college == null) {
            return ResponseEntity.notFound().build();
        }

        long activePrograms = programRepository.countActiveByCollegeId(id);
        if (activePrograms > 0) {
            return ResponseEntity.badRequest().body(
                    "This college still has " + activePrograms + " active program(s). Archive them first.");
        }

        college.setIsArchived(true);
        return ResponseEntity.ok(toResponse(collegeRepository.save(college), 0L));
    }

    @PatchMapping("/{id}/restore")
    @Transactional
    public ResponseEntity<?> restore(@PathVariable Long id) {
        College college = collegeRepository.findById(id).orElse(null);
        if (college == null) {
            return ResponseEntity.notFound().build();
        }

        college.setIsArchived(false);
        return ResponseEntity.ok(toResponse(
                collegeRepository.save(college),
                programRepository.countActiveByCollegeId(id)));
    }

    private CollegeResponse toResponse(College c, long programsCount) {
        return new CollegeResponse(
                c.getId(), c.getName(), c.getAbbreviation(), c.getDean(), c.getLogo(),
                c.getIsArchived(), programsCount, c.getCreatedAt(), c.getUpdatedAt());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String validate(CollegeRequest request) {
        if (request == null) {
            return "Request body is required.";
        }

        String name = clean(request.getName());
        String abbreviation = clean(request.getAbbreviation());
        String dean = clean(request.getDean());

        if (name.isEmpty()) return "College name is required.";
        if (name.length() > 255) return "College name is too long (max 255 characters).";
        if (abbreviation.isEmpty()) return "Abbreviation is required.";
        if (abbreviation.length() > 20) return "Abbreviation is too long (max 20 characters).";
        if (dean.isEmpty()) return "Dean is required.";
        if (dean.length() > 45) return "Dean name is too long (max 45 characters).";
        return null;
    }
}