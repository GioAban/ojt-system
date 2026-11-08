package com.iodev.practicum.controller;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.service.PrivacySettings;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Comparator;

/** Privacy Notice: pampublikong detalye, at ang isang beses na pagkilala ng student */
@RestController
public class PrivacyController {

    public record PrivacyInfo(String dpoName, String dpoEmail, String retention, String version) {}

    public record AckResult(String version, String acknowledgedAt) {}

    @Autowired private PrivacySettings settings;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentManagementRepository studentManagementRepository;

    @GetMapping("/api/public/privacy")
    public PrivacyInfo info() {
        return new PrivacyInfo(settings.getDpoName(), settings.getDpoEmail(),
                settings.getRetention(), settings.getNoticeVersion());
    }

    @PostMapping("/api/student/privacy/acknowledge")
    @Transactional
    public ResponseEntity<?> acknowledge(Authentication authentication) {
        // Pareho sa /student/profile: ang pinakabagong rekord ng student na may ganitong email
        Student s = studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");

        LocalDateTime now = LocalDateTime.now();
        s.setPrivacyAckAt(now);
        s.setPrivacyAckVersion(settings.getNoticeVersion());
        studentRepository.save(s);
        return ResponseEntity.ok(new AckResult(settings.getNoticeVersion(), now.toString()));
    }
}
