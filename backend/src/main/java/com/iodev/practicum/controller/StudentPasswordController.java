package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentManagementDtos.ChangePasswordRequest;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Ang student mismo ang nagpapalit ng password. Kailangang naka-login (JWT) at ang
 * authentication.getName() ay ang email ng student. Dito nawawala ang "must change password".
 */
@RestController
@RequestMapping("/api/student")
public class StudentPasswordController {

    @Autowired private StudentManagementRepository repository;
    @Autowired private PasswordEncoder passwordEncoder;

    @PostMapping("/change-password")
    @Transactional
    public ResponseEntity<?> change(@RequestBody ChangePasswordRequest r, Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(401).build();
        List<Student> found = repository.findByEmail(authentication.getName());
        if (found.isEmpty()) return ResponseEntity.status(403).body("Student account not found.");
        Student s = found.get(0);

        String current = r == null || r.currentPassword() == null ? "" : r.currentPassword();
        String next = r == null || r.newPassword() == null ? "" : r.newPassword();

        if (!passwordEncoder.matches(current, s.getPassword())) {
            return ResponseEntity.badRequest().body("Your current password is incorrect.");
        }
        if (next.length() < 8) return ResponseEntity.badRequest().body("New password must be at least 8 characters.");
        if (next.length() > 72) return ResponseEntity.badRequest().body("New password is too long (max 72 characters).");
        if (next.equals(current)) return ResponseEntity.badRequest().body("Choose a password different from the temporary one.");

        s.setPassword(passwordEncoder.encode(next));
        s.setTemporaryPassword(null);
        s.setMustChangePassword(false);
        repository.save(s);
        return ResponseEntity.ok().build();
    }
}
