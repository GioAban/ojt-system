package com.iodev.practicum.controller;

import com.iodev.practicum.dto.AuthResponse;
import com.iodev.practicum.dto.LoginRequest;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.security.JwtUtil;
import com.iodev.practicum.security.LoginIdentifierResolver;
import com.iodev.practicum.service.RegistrationService;
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
    private StudentRegistrationRepository registrations;

    @Autowired
    private LoginIdentifierResolver loginIdentifierResolver;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        String password = request.getPassword() == null ? "" : request.getPassword();
        // Email o Student ID ang inilagay; ginagawang email dito
        String input = request.getEmail() == null ? "" : request.getEmail().trim();
        String email = loginIdentifierResolver.resolveEmail(input);
        Student student = email == null || email.isEmpty() ? null : studentRepository.findByEmail(email).orElse(null);

        if (student == null) {
            // Nag-register pero hindi pa verified (o na-reject): ipaalam lang kapag tama ang password,
            // para walang malaman ang ibang tao tungkol sa registration
            if (!input.isEmpty()) {
                // Pinakabago muna; hanggang 5 lang para hindi mabagal ang BCrypt
                for (StudentRegistration r : registrations.findForLogin(input).stream().limit(5).toList()) {
                    if (passwordEncoder.matches(password, r.getPasswordHash())) {
                        return ResponseEntity.status(403).body(RegistrationService.loginMessage(r));
                    }
                }
            }
            return ResponseEntity.status(401).body("Invalid email or password.");
        }

        if (!passwordEncoder.matches(password, student.getPassword())) {
            return ResponseEntity.status(401).body("Invalid email or password.");
        }
        if (Boolean.TRUE.equals(student.getIsArchived())) {
            // Na-revoke ng coordinator: sabihin lang kapag tama ang password (kagaya ng rejected na registration)
            if (student.getAccessRevokedAt() != null) {
                String reason = student.getAccessRevokeReason() == null ? "" : " Reason: " + student.getAccessRevokeReason();
                return ResponseEntity.status(403).body("Your coordinator removed your access to the OJT System." + reason
                        + " If you think this is a mistake, contact your coordinator.");
            }
            return ResponseEntity.status(401).body("Invalid email or password.");
        }

        String token = jwtUtil.generateToken(student.getEmail());
        String fullname = student.getFirstname() + " " + student.getLastname();
        return ResponseEntity.ok(new AuthResponse(token, student.getEmail(), fullname, "STUDENT", null));
    }
}
