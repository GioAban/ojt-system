package com.iodev.practicum.controller;

import com.iodev.practicum.dto.AuthResponse;
import com.iodev.practicum.dto.LoginRequest;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/student")
public class StudentAuthController {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Student student = studentRepository.findByEmail(request.getEmail()).orElse(null);

        if (student == null
                || Boolean.TRUE.equals(student.getIsArchived())
                || !passwordEncoder.matches(request.getPassword(), student.getPassword())) {
            return ResponseEntity.status(401).body("Invalid email or password.");
        }

        String token = jwtUtil.generateToken(student.getEmail());
        String fullname = student.getFirstname() + " " + student.getLastname();
        return ResponseEntity.ok(new AuthResponse(token, student.getEmail(), fullname, "STUDENT", null));
    }
}