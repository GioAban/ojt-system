package com.iodev.practicum.controller;

import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.EmailTokenService;
import com.iodev.practicum.service.PasswordResetService;
import com.iodev.practicum.service.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * PUBLIC (/api/auth/** ay permitAll): Forgot password at pag-reset gamit ang link sa email.
 * Ang "forgot" ay laging parehong sagot, may account man o wala ang email.
 */
@RestController
@RequestMapping("/api/auth/password")
public class PasswordResetController {

    private static final long FIFTEEN_MINUTES = 15 * 60_000;
    private static final String SENT = "If that email has an account, we sent a link to reset the password.";

    public record ForgotBody(String email) {}

    public record TokenBody(String token) {}

    public record ResetBody(String token, String password, String confirmPassword) {}

    @Autowired private PasswordResetService resets;
    @Autowired private RateLimiter limiter;

    @PostMapping("/forgot")
    public ResponseEntity<?> forgot(@RequestBody(required = false) ForgotBody body, HttpServletRequest http) {
        if (!limiter.allow("ip:forgot:" + http.getRemoteAddr(), 10, FIFTEEN_MINUTES)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        resets.forgot(body == null ? null : body.email());
        return ResponseEntity.ok(Map.of("state", "sent", "message", SENT,
                "cooldown", EmailTokenService.COOLDOWN.toSeconds()));
    }

    /** Tinitingnan lang ang link (hindi ito ginagamit): valid | expired | used | invalid */
    @PostMapping("/check")
    public ResponseEntity<?> check(@RequestBody(required = false) TokenBody body, HttpServletRequest http) {
        if (!limiter.allow("ip:reset-check:" + http.getRemoteAddr(), 30, FIFTEEN_MINUTES)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        return ResponseEntity.ok(Map.of("state", resets.check(body == null ? null : body.token())));
    }

    @PostMapping("/reset")
    public ResponseEntity<?> reset(@RequestBody(required = false) ResetBody body, HttpServletRequest http) {
        if (!limiter.allow("ip:reset:" + http.getRemoteAddr(), 10, FIFTEEN_MINUTES)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        if (body == null) return ResponseEntity.badRequest().body("Fill in the form.");
        try {
            resets.reset(body.token(), body.password(), body.confirmPassword());
        } catch (ActionException e) {
            return e.toResponse();
        }
        return ResponseEntity.ok(Map.of("state", "changed"));
    }
}
