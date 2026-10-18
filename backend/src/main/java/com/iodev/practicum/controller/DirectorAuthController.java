package com.iodev.practicum.controller;

import com.iodev.practicum.dto.AuthResponse;
import com.iodev.practicum.dto.LoginRequest;
import com.iodev.practicum.model.Director;
import com.iodev.practicum.repository.DirectorRepository;
import com.iodev.practicum.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/director")
public class DirectorAuthController {

    @Autowired
    private DirectorRepository directorRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Director director = directorRepository.findByEmail(request.getEmail()).orElse(null);

        if (director == null || !passwordEncoder.matches(request.getPassword(), director.getPassword())) {
            return ResponseEntity.status(401).body("Invalid email or password.");
        }

        String token = jwtUtil.generateToken(director.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, director.getEmail(), director.getFullname(), "ADMIN", null));
    }
}