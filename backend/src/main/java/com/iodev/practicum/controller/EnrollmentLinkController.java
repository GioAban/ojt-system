package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentManagementDtos.AcceptAllResult;
import com.iodev.practicum.dto.StudentManagementDtos.AccountRow;
import com.iodev.practicum.dto.StudentManagementDtos.ApprovalResult;
import com.iodev.practicum.dto.StudentManagementDtos.BulkRequestIds;
import com.iodev.practicum.dto.StudentManagementDtos.EnrollmentLinkRequest;
import com.iodev.practicum.dto.StudentManagementDtos.EnrollmentLinkState;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EnrollmentLink;
import com.iodev.practicum.model.EnrollmentRequest;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.EnrollmentLinkRepository;
import com.iodev.practicum.repository.EnrollmentRequestRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.util.DefaultPassword;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Ang coordinator ang gumagawa, nagbubukas, nagsasara, at nagpapalit ng enrollment link */
@RestController
@RequestMapping("/api/coordinator/student-management/enrollment")
public class EnrollmentLinkController {

    public static final ZoneId ZONE = ZoneId.of("Asia/Manila");
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private EnrollmentLinkRepository links;
    @Autowired private StudentManagementRepository students;
    @Autowired private EnrollmentRequestRepository requests;
    @Autowired private PasswordEncoder passwordEncoder;
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
    // Accounts tab: listahan, accept, reject
    // ---------------------------------------------------------------------

    /** Lahat ng hindi-archived na student ng coordinator sa semester, may status ng account */
    @GetMapping("/accounts")
    @Transactional(readOnly = true)
    public ResponseEntity<?> accounts(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Map<Long, EnrollmentRequest> pending = new HashMap<>();
        for (EnrollmentRequest r : requests.findPending(coordinator.getId(), semesterId)) {
            pending.put(r.getStudent().getId(), r);
        }

        List<AccountRow> rows = new ArrayList<>();
        for (Student s : students.findForManagement(coordinator.getId(), semesterId)) {
            if (Boolean.TRUE.equals(s.getIsArchived())) continue;
            boolean active = s.getEmail() != null && !s.getEmail().isBlank();
            EnrollmentRequest req = active ? null : pending.get(s.getId());
            String status = active ? "active" : req != null ? "pending" : "none";
            rows.add(new AccountRow(
                    s.getId(),
                    req == null ? null : req.getId(),
                    s.getStudentNumber(), s.getLastname(), s.getFirstname(), s.getMiddleInitial(), s.getYear(),
                    active ? s.getEmail() : req == null ? null : req.getEmail(),
                    status,
                    req == null ? null : req.getCreatedAt().toString(),
                    active && Boolean.TRUE.equals(s.getMustChangePassword())));
        }
        return ResponseEntity.ok(rows);
    }

    /** I-accept ang hiling: gagawa ng account na ang password ay default (ID + initials) */
    @PostMapping("/requests/{id}/accept")
    @Transactional
    public ResponseEntity<?> accept(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        EnrollmentRequest req = requests.findById(id).orElse(null);
        if (req == null || !req.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(404).body("Request not found.");
        }
        String problem = approve(req);
        if (problem != null) return ResponseEntity.status(409).body(problem);

        Student s = req.getStudent();
        return ResponseEntity.ok(new ApprovalResult(
                s.getId(), s.getLastname() + ", " + s.getFirstname(), req.getEmail(), DefaultPassword.of(s)));
    }

    /** I-accept lahat ng nakabinbin; ang may problema (hal. email na gamit na) ay nilalaktawan */
    @PostMapping("/requests/accept-all")
    @Transactional
    public ResponseEntity<?> acceptAll(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        int accepted = 0, skipped = 0;
        for (EnrollmentRequest req : requests.findPending(coordinator.getId(), semesterId)) {
            if (approve(req) == null) accepted++;
            else skipped++;
        }
        return ResponseEntity.ok(new AcceptAllResult(accepted, skipped));
    }

    /** I-accept ang mga piniling hiling; ang may problema ay nilalaktawan. accepted = bilang na na-accept */
    @PostMapping("/requests/bulk-accept")
    @Transactional
    public ResponseEntity<?> bulkAccept(@RequestBody BulkRequestIds body, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        int done = 0, skipped = 0;
        for (EnrollmentRequest req : ownRequests(body, coordinator)) {
            if (approve(req) == null) done++;
            else skipped++;
        }
        return ResponseEntity.ok(new AcceptAllResult(done, skipped));
    }

    /** I-reject ang mga piniling hiling. accepted = bilang na na-reject (parehong hugis ng resulta) */
    @PostMapping("/requests/bulk-reject")
    @Transactional
    public ResponseEntity<?> bulkReject(@RequestBody BulkRequestIds body, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        int done = 0, skipped = 0;
        for (EnrollmentRequest req : ownRequests(body, coordinator)) {
            if (!EnrollmentRequest.PENDING.equals(req.getStatus())) {
                skipped++;
                continue;
            }
            req.setStatus(EnrollmentRequest.REJECTED);
            req.setDecidedAt(LocalDateTime.now());
            requests.save(req);
            done++;
        }
        return ResponseEntity.ok(new AcceptAllResult(done, skipped));
    }

    /** Mga request na pag-aari ng coordinator na ito lamang; ang iba ay hindi pinapansin */
    private List<EnrollmentRequest> ownRequests(BulkRequestIds body, Coordinator coordinator) {
        List<EnrollmentRequest> own = new ArrayList<>();
        if (body == null || body.requestIds() == null) return own;
        for (Long id : body.requestIds().stream().filter(java.util.Objects::nonNull).distinct().limit(1000).toList()) {
            EnrollmentRequest req = requests.findById(id).orElse(null);
            if (req != null && req.getCoordinator().getId().equals(coordinator.getId())) own.add(req);
        }
        return own;
    }

    @PostMapping("/requests/{id}/reject")
    @Transactional
    public ResponseEntity<?> reject(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        EnrollmentRequest req = requests.findById(id).orElse(null);
        if (req == null || !req.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(404).body("Request not found.");
        }
        if (!EnrollmentRequest.PENDING.equals(req.getStatus())) {
            return ResponseEntity.status(409).body("This request was already handled.");
        }
        req.setStatus(EnrollmentRequest.REJECTED);
        req.setDecidedAt(LocalDateTime.now());
        requests.save(req);
        return ResponseEntity.ok().build();
    }

    /** Ibinabalik ang dahilan kung hindi puwede; null kung na-accept */
    private String approve(EnrollmentRequest req) {
        if (!EnrollmentRequest.PENDING.equals(req.getStatus())) return "This request was already handled.";
        Student s = req.getStudent();
        if (Boolean.TRUE.equals(s.getIsArchived())) return "This student is archived. Restore the student first.";
        if (s.getEmail() != null && !s.getEmail().isBlank()) return "This student already has an account.";
        if (students.emailExists(req.getEmail())) return "That email is already used by another account. Reject this request.";

        s.setEmail(req.getEmail());
        s.setPassword(passwordEncoder.encode(DefaultPassword.of(s)));
        s.setTemporaryPassword(null);
        s.setIsVerified(true);
        s.setMustChangePassword(true);
        students.save(s);

        req.setStatus(EnrollmentRequest.APPROVED);
        req.setDecidedAt(LocalDateTime.now());
        requests.save(req);
        return null;
    }

    // ---------------------------------------------------------------------

    public static boolean isActive(EnrollmentLink link) {
        if (!link.isOpen()) return false;
        return link.getDueDate() == null || !LocalDate.now(ZONE).isAfter(link.getDueDate());
    }

    private EnrollmentLinkState state(Coordinator coordinator, Long semesterId, EnrollmentLink link) {
        long total = 0, registered = 0;
        for (Student s : students.findForManagement(coordinator.getId(), semesterId)) {
            if (Boolean.TRUE.equals(s.getIsArchived())) continue;
            total++;
            if (s.getEmail() != null && !s.getEmail().isBlank()) registered++;
        }
        long pending = requests.countPending(coordinator.getId(), semesterId);
        if (link == null) return new EnrollmentLinkState(false, null, false, null, false, registered, total, pending);
        return new EnrollmentLinkState(true, link.getToken(), link.isOpen(),
                link.getDueDate() == null ? null : link.getDueDate().toString(),
                isActive(link), registered, total, pending);
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
