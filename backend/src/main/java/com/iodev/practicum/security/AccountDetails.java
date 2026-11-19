package com.iodev.practicum.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.time.LocalDateTime;
import java.util.Collection;

/**
 * UserDetails na may dalang password_changed_at, para matanggihan ng JwtAuthFilter ang token na ginawa bago
 * na-reset ang password (nang walang dagdag na query). null = walang epekto (kagaya ng dati).
 */
public class AccountDetails extends User {

    private final LocalDateTime passwordChangedAt;

    public AccountDetails(String username, String password, boolean enabled,
                          Collection<? extends GrantedAuthority> authorities, LocalDateTime passwordChangedAt) {
        super(username, password, enabled, true, true, true, authorities);
        this.passwordChangedAt = passwordChangedAt;
    }

    public LocalDateTime getPasswordChangedAt() {
        return passwordChangedAt;
    }
}
