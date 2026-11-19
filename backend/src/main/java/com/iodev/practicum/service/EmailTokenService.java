package com.iodev.practicum.service;

import com.iodev.practicum.model.EmailToken;
import com.iodev.practicum.repository.EmailTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;

/**
 * Mga link sa email: 32 random bytes (base64url), ang SHA-256 lang ang naka-save, isang beses lang magagamit,
 * at ang bagong link ay nagsasara sa mga luma ng parehong subject.
 * Dito rin ang hangganan ng dami ng email kada address (laban sa pag-spam sa inbox ng ibang tao).
 */
@Service
public class EmailTokenService {

    /** Pagitan bago makapagpadala ulit sa parehong address */
    public static final Duration COOLDOWN = Duration.ofSeconds(60);
    /** Pinakamaraming email kada address (at kada registration/account) sa loob ng 24 oras */
    public static final int MAX_PER_DAY = 5;

    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired private EmailTokenRepository tokens;

    /** Ang resulta ng paghahanap ng token mula sa link */
    public enum State { VALID, EXPIRED, USED, INVALID }

    public record Lookup(State state, EmailToken token) {}

    /**
     * Puwede bang magpadala ngayon? Hindi kapag kapapadala lang sa address na ito (cooldown),
     * o naabot na ang hangganan ng address o ng subject sa loob ng 24 oras.
     */
    public boolean mayIssue(String purpose, String subjectType, Long subjectId, String email) {
        String e = normal(email);
        LocalDateTime now = LocalDateTime.now();
        if (tokens.countSentTo(e, purpose, now.minus(COOLDOWN)) > 0) return false;
        if (tokens.countSentTo(e, purpose, now.minusHours(24)) >= MAX_PER_DAY) return false;
        return tokens.countSentFor(subjectType, subjectId, purpose, now.minusHours(24)) < MAX_PER_DAY;
    }

    /** Bagong link; ang mga luma ng parehong subject at layunin ay hindi na gagana. Ibinabalik ang token. */
    public String issue(String purpose, String subjectType, Long subjectId, String email, Duration validFor) {
        tokens.closeOpen(subjectType, subjectId, purpose, LocalDateTime.now());
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.save(new EmailToken(purpose, hash(raw), subjectType, subjectId, normal(email),
                LocalDateTime.now().plus(validFor)));
        return raw;
    }

    public Lookup find(String raw, String purpose) {
        if (raw == null || raw.isBlank() || raw.length() > 100) return new Lookup(State.INVALID, null);
        Optional<EmailToken> found = tokens.findByTokenHash(hash(raw.trim()));
        if (found.isEmpty() || !purpose.equals(found.get().getPurpose())) return new Lookup(State.INVALID, null);
        EmailToken t = found.get();
        if (t.isUsed()) return new Lookup(State.USED, t);
        if (t.isExpired()) return new Lookup(State.EXPIRED, t);
        return new Lookup(State.VALID, t);
    }

    public void markUsed(EmailToken t) {
        t.setUsedAt(LocalDateTime.now());
        tokens.save(t);
    }

    public void closeAll(String subjectType, Long subjectId, String purpose) {
        tokens.closeOpen(subjectType, subjectId, purpose, LocalDateTime.now());
    }

    static String normal(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    static String hash(String raw) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
