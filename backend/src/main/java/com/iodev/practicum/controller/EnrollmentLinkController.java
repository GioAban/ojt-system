package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentManagementDtos.EnrollmentLinkRequest;
import com.iodev.practicum.dto.StudentManagementDtos.EnrollmentLinkState;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EnrollmentLink;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.EnrollmentLinkRepository;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Base64;

/** Ang coordinator ang gumagawa, nagbubukas, nagsasara, at nagpapalit ng registration link */
@RestController
@RequestMapping("/api/coordinator/student-management/enrollment")
public class EnrollmentLinkController {

    public static final ZoneId ZONE = ZoneId.of("Asia/Manila");
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private EnrollmentLinkRepository links;
    @Autowired private StudentRegistrationRepository registrations;
    @PersistenceContext private EntityManager em;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> get(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        return ResponseEntity.ok(state(coordinator, semesterId, links.findFor(coordinator.getId(), semesterId).orElse(null)));
    }

    /** Gumawa o baguhin ang due date at open/closed */
    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@RequestBody EnrollmentLinkRequest r, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        if (r == null || r.semesterId() == null) return ResponseEntity.badRequest().body("Choose a semester first.");

        LocalDate due = null;
        if (r.dueDate() != null && !r.dueDate().isBlank()) {
            try {
                due = LocalDate.parse(r.dueDate().trim());
            } catch (DateTimeParseException e) {
                return ResponseEntity.badRequest().body("Due date must look like 2026-10-31.");
            }
            if (due.isBefore(LocalDate.now(ZONE))) {
                return ResponseEntity.badRequest().body("The due date can't be in the past.");
            }
        }

        EnrollmentLink link = links.findFor(coordinator.getId(), r.semesterId()).orElse(null);
        if (link == null) {
            link = new EnrollmentLink();
            link.setCoordinator(coordinator);
            link.setSemester(em.getReference(Semester.class, r.semesterId()));
            link.setToken(newToken());
        }
        link.setDueDate(due);
        if (r.open() != null) link.setOpen(r.open());
        if (r.requireApproval() != null) link.setRequireApproval(r.requireApproval());
        link.touch();
        links.save(link);

        return ResponseEntity.ok(state(coordinator, r.semesterId(), link));
    }

    /** Bagong link; hindi na gagana ang luma */
    @PostMapping("/regenerate")
    @Transactional
    public ResponseEntity<?> regenerate(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        EnrollmentLink link = links.findFor(coordinator.getId(), semesterId).orElse(null);
        if (link == null) return ResponseEntity.status(404).body("Create a link first.");

        link.setToken(newToken());
        link.touch();
        links.save(link);
        return ResponseEntity.ok(state(coordinator, semesterId, link));
    }

    // ---------------------------------------------------------------------

    public static boolean isActive(EnrollmentLink link) {
        if (!link.isOpen()) return false;
        return link.getDueDate() == null || !LocalDate.now(ZONE).isAfter(link.getDueDate());
    }

    private EnrollmentLinkState state(Coordinator coordinator, Long semesterId, EnrollmentLink link) {
        long pending = 0, verified = 0, rejected = 0, awaitingEmail = 0, revoked = 0;
        for (Object[] row : registrations.countByStatus(coordinator.getId(), semesterId)) {
            long n = ((Number) row[1]).longValue();
            switch (String.valueOf(row[0])) {
                case StudentRegistration.PENDING -> pending = n;
                case StudentRegistration.VERIFIED -> verified = n;
                case StudentRegistration.REJECTED -> rejected = n;
                case StudentRegistration.EMAIL_PENDING -> awaitingEmail = n;
                case StudentRegistration.REVOKED -> revoked = n;
                default -> { }
            }
        }
        long total = pending + verified + rejected + awaitingEmail + revoked;
        if (link == null) {
            return new EnrollmentLinkState(false, null, false, null, false, pending, verified, rejected, total,
                    false, awaitingEmail, revoked);
        }
        return new EnrollmentLinkState(true, link.getToken(), link.isOpen(),
                link.getDueDate() == null ? null : link.getDueDate().toString(),
                isActive(link), pending, verified, rejected, total,
                link.isRequireApproval(), awaitingEmail, revoked);
    }

    /** 32 random bytes (~43 characters): hindi mahuhulaan */
    private String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }
}
