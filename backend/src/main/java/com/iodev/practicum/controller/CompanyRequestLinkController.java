package com.iodev.practicum.controller;

import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CompanyRequestLink;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CompanyRequestLinkRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
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

/** Ang coordinator ang gumagawa, nagbubukas, nagsasara, at nagpapalit ng public link para sa mga company */
@RestController
@RequestMapping("/api/coordinator/company-requests/link")
public class CompanyRequestLinkController {

    public static final ZoneId ZONE = ZoneId.of("Asia/Manila");
    private static final SecureRandom RANDOM = new SecureRandom();

    public record LinkRequest(Long semesterId, String dueDate, Boolean open) {}

    /** exists=false kung wala pang link. active = bukas at hindi pa lampas sa due date */
    public record LinkState(boolean exists, String token, boolean open, String dueDate, boolean active) {}

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CompanyRequestLinkRepository links;
    @PersistenceContext private EntityManager em;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> get(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        return ResponseEntity.ok(state(links.findFor(coordinator.getId(), semesterId).orElse(null)));
    }

    /** Gumawa o baguhin ang due date at open/closed */
    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@RequestBody LinkRequest r, Authentication authentication) {
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
        }

        CompanyRequestLink link = links.findFor(coordinator.getId(), r.semesterId()).orElse(null);
        // Bawal ang petsang lumipas, pero huwag harangin ang pag-stop/start kung hindi naman binago ang petsa
        boolean dueChanged = link == null || due == null
                ? due != null
                : !due.equals(link.getDueDate());
        if (due != null && dueChanged && due.isBefore(LocalDate.now(ZONE))) {
            return ResponseEntity.badRequest().body("The due date can't be in the past.");
        }
        if (link == null) {
            link = new CompanyRequestLink();
            link.setCoordinator(coordinator);
            link.setSemester(em.getReference(Semester.class, r.semesterId()));
            link.setToken(newToken());
        }
        link.setDueDate(due);
        if (r.open() != null) link.setOpen(r.open());
        link.touch();
        links.save(link);

        return ResponseEntity.ok(state(link));
    }

    /** Bagong link; hindi na gagana ang luma */
    @PostMapping("/regenerate")
    @Transactional
    public ResponseEntity<?> regenerate(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        CompanyRequestLink link = links.findFor(coordinator.getId(), semesterId).orElse(null);
        if (link == null) return ResponseEntity.status(404).body("Create a link first.");

        link.setToken(newToken());
        link.touch();
        links.save(link);
        return ResponseEntity.ok(state(link));
    }

    // ---------------------------------------------------------------------

    public static boolean isActive(CompanyRequestLink link) {
        if (!link.isOpen()) return false;
        return link.getDueDate() == null || !LocalDate.now(ZONE).isAfter(link.getDueDate());
    }

    private LinkState state(CompanyRequestLink link) {
        if (link == null) return new LinkState(false, null, false, null, false);
        return new LinkState(true, link.getToken(), link.isOpen(),
                link.getDueDate() == null ? null : link.getDueDate().toString(), isActive(link));
    }

    private String newToken() {
        byte[] bytes = new byte[24];
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
