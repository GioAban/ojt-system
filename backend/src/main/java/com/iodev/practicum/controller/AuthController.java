package com.iodev.practicum.controller;

import com.iodev.practicum.dto.*;
import com.iodev.practicum.model.*;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.ProgramRepository;
import com.iodev.practicum.repository.UserRepository;
import com.iodev.practicum.security.JwtUtil;
import com.iodev.practicum.security.LoginIdentifierResolver;
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

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Email already registered.");
        }

        Program program = programRepository.findById(request.getProgramId())
                .orElse(null);

        if (program == null) {
            return ResponseEntity.badRequest().body("Invalid program ID.");
        }

        User user = new User();
        user.setFullname(request.getFullname());
        user.setEmail(request.getEmail());
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
        coordinatorRepository.save(coordinator);

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