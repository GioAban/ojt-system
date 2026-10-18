package com.iodev.practicum.controller;

import com.iodev.practicum.dto.SemesterRequest;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.SemesterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/semesters")
public class SemesterController {

   private static final Pattern NAME_PATTERN =
        Pattern.compile("^(1st Semester|2nd Semester|Midyear) (\\d{4})-(\\d{4})$");

    @Autowired
    private SemesterRepository semesterRepository;

    @GetMapping
    public List<Semester> getAll() {
        return semesterRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody SemesterRequest request) {
        String name = normalize(request);
        String error = nameError(name);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }
        if (semesterRepository.existsBySemesterIgnoreCase(name)) {
            return ResponseEntity.status(409).body("That semester already exists.");
        }

        Semester semester = new Semester();
        semester.setSemester(name);
        semester.setIsArchived(false);
        // Ang pinakaunang semester ay awtomatikong magiging default
        semester.setIsDefault(semesterRepository.count() == 0);
        return ResponseEntity.ok(semesterRepository.save(semester));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody SemesterRequest request) {
        Semester semester = semesterRepository.findById(id).orElse(null);
        if (semester == null) {
            return ResponseEntity.notFound().build();
        }

        String name = normalize(request);
        String error = nameError(name);
        if (error != null) {
            return ResponseEntity.badRequest().body(error);
        }
        if (semesterRepository.existsBySemesterIgnoreCaseAndIdNot(name, id)) {
            return ResponseEntity.status(409).body("That semester already exists.");
        }

        semester.setSemester(name);
        return ResponseEntity.ok(semesterRepository.save(semester));
    }

    @PatchMapping("/{id}/default")
    @Transactional
    public ResponseEntity<?> setDefault(@PathVariable Long id) {
        Semester semester = semesterRepository.findById(id).orElse(null);
        if (semester == null) {
            return ResponseEntity.notFound().build();
        }
        if (Boolean.TRUE.equals(semester.getIsArchived())) {
            return ResponseEntity.badRequest().body("Restore this semester before setting it as default.");
        }
        if (Boolean.TRUE.equals(semester.getIsDefault())) {
            return ResponseEntity.ok(semester);
        }

        semesterRepository.clearDefault();
        Semester fresh = semesterRepository.findById(id).orElseThrow();
        fresh.setIsDefault(true);
        return ResponseEntity.ok(semesterRepository.save(fresh));
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archive(@PathVariable Long id) {
        Semester semester = semesterRepository.findById(id).orElse(null);
        if (semester == null) {
            return ResponseEntity.notFound().build();
        }
        if (Boolean.TRUE.equals(semester.getIsDefault())) {
            return ResponseEntity.badRequest()
                    .body("The default semester can't be archived. Set another semester as default first.");
        }

        semester.setIsArchived(true);
        return ResponseEntity.ok(semesterRepository.save(semester));
    }

    @PatchMapping("/{id}/restore")
    @Transactional
    public ResponseEntity<?> restore(@PathVariable Long id) {
        Semester semester = semesterRepository.findById(id).orElse(null);
        if (semester == null) {
            return ResponseEntity.notFound().build();
        }

        semester.setIsArchived(false);
        return ResponseEntity.ok(semesterRepository.save(semester));
    }

    private String normalize(SemesterRequest request) {
        if (request == null || request.getSemester() == null) {
            return "";
        }
        return request.getSemester().trim().replaceAll("\\s+", " ");
    }

    private String nameError(String name) {
        Matcher matcher = NAME_PATTERN.matcher(name);
        if (!matcher.matches()) {
            return "Semester must look like \"1st Semester 2025-2026\", \"2nd Semester 2025-2026\" or \"Midyear 2025-2026\".";
        }
        int start = Integer.parseInt(matcher.group(2));
        int end = Integer.parseInt(matcher.group(3));
        if (end != start + 1) {
            return "The end year must be one year after the start year.";
        }
        return null;
    }
}