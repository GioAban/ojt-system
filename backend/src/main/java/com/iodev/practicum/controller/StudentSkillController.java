package com.iodev.practicum.controller;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.service.SkillService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;

/** Mga skill ng student mismo (Profile at Companies page) */
@RestController
@RequestMapping("/api/student/skills")
public class StudentSkillController {

    public record SkillsBody(List<String> skills) {}

    @Autowired private StudentManagementRepository students;
    @Autowired private SkillService skillService;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> mine(Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        return ResponseEntity.ok(new SkillsBody(skillService.studentSkills(s.getId())));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@RequestBody SkillsBody body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        List<String> raw = body == null || body.skills() == null ? List.of() : body.skills();
        String error = SkillService.validate(raw);
        if (error != null) return ResponseEntity.badRequest().body(error);
        return ResponseEntity.ok(new SkillsBody(skillService.setStudentSkills(s, raw)));
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public ResponseEntity<?> search(@RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(skillService.search(q));
    }

    /** Pareho sa ibang bahagi ng student: ang pinakabagong rekord na may ganitong email */
    private Student current(Authentication auth) {
        if (auth == null) return null;
        return students.findByEmail(auth.getName()).stream().max(Comparator.comparing(Student::getId)).orElse(null);
    }
}
