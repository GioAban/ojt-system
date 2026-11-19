package com.iodev.practicum.controller;

import com.iodev.practicum.service.EmailTokenService;
import com.iodev.practicum.service.RateLimiter;
import com.iodev.practicum.service.RegistrationEmailService;
import com.iodev.practicum.service.RegistrationEmailService.VerifyResult;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * PUBLIC (/api/enroll/** ay permitAll): pagbukas ng link sa email at resend.
 * Ang resend ay laging parehong sagot, kaya walang malalaman kung may registration ang isang email.
 */
@RestController
@RequestMapping("/api/enroll")
public class EmailVerificationController {

    private static final long FIFTEEN_MINUTES = 15 * 60_000;

    public record TokenBody(String token) {}

    public record EmailBody(String email) {}

    @Autowired private RegistrationEmailService verification;
    @Autowired private RateLimiter limiter;

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody(required = false) TokenBody body, HttpServletRequest http) {
        if (!limiter.allow("ip:verify:" + http.getRemoteAddr(), 30, FIFTEEN_MINUTES)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        VerifyResult r = verification.verify(body == null ? null : body.token());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("result", r.result());
        out.put("firstName", r.firstName() == null ? "" : r.firstName());
        out.put("college", r.college() == null ? "" : r.college());
        return ResponseEntity.ok(out);
    }

    /** Bagong link mula sa nag-expire na link */
    @PostMapping("/verify/resend")
    public ResponseEntity<?> resendFromLink(@RequestBody(required = false) TokenBody body, HttpServletRequest http) {
        if (!limiter.allow("ip:resend:" + http.getRemoteAddr(), 10, FIFTEEN_MINUTES)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        verification.resendByToken(body == null ? null : body.token());
        return sent();
    }

    /** "Resend" sa Check your email at sa login */
    @PostMapping("/resend")
    public ResponseEntity<?> resend(@RequestBody(required = false) EmailBody body, HttpServletRequest http) {
        if (!limiter.allow("ip:resend:" + http.getRemoteAddr(), 10, FIFTEEN_MINUTES)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        String email = body == null || body.email() == null ? "" : body.email().trim();
        if (!email.isEmpty() && email.length() <= 255 && email.contains("@")) {
            verification.resendByEmail(email);
        }
        return sent();
    }

    private static ResponseEntity<?> sent() {
        return ResponseEntity.ok(Map.of("state", "sent", "cooldown", EmailTokenService.COOLDOWN.toSeconds()));
    }
}
