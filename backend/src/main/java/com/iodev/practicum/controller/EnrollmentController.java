package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentManagementDtos.ClaimRequest;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EnrollmentLink;
import com.iodev.practicum.model.EnrollmentRequest;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.EnrollmentLinkRepository;
import com.iodev.practicum.repository.EnrollmentRequestRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Pattern;

/**
 * PUBLIC na endpoint ng enrollment link. Idagdag ang /api/enroll/** sa permitAll ng SecurityConfig.
 * Student ID + email lang ang hinihingi at gumagawa ito ng HILING; walang account hangga't
 * hindi ina-accept ng coordinator.
 */
@RestController
@RequestMapping("/api/enroll")
public class EnrollmentController {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    // Hangganan ng maling subok kada IP
    private static final int MAX_FAILURES = 8;
    private static final long WINDOW_MS = 10 * 60_000;
    private final Map<String, Deque<Long>> failures = new HashMap<>();

    @Autowired private EnrollmentLinkRepository links;
    @Autowired private EnrollmentRequestRepository requests;
    @Autowired private StudentManagementRepository repository;

    /** Status ng link at detalye ng portal (college, program, semester, coordinator) para sa claim page */
    @GetMapping("/info")
    @Transactional(readOnly = true)
    public ResponseEntity<?> info(@RequestParam String token) {
        EnrollmentLink link = links.findByToken(token).orElse(null);
        if (link == null) return ResponseEntity.ok(Map.of("status", "invalid"));

        Coordinator coordinator = link.getCoordinator();
        Program program = coordinator.getProgram();
        College college = program == null ? null : program.getCollege();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", statusOf(link));
        out.put("dueDate", link.getDueDate() == null ? "" : link.getDueDate().toString());
        out.put("college", college == null ? "" : nz(college.getName()));
        out.put("collegeAbbreviation", college == null ? "" : nz(college.getAbbreviation()));
        out.put("program", program == null ? "" : nz(program.getName()));
        out.put("programAbbreviation", program == null ? "" : nz(program.getAbbreviation()));
        out.put("semester", semesterLabel(link.getSemester()));
        out.put("coordinator", coordinator.getUser() == null ? "" : nz(coordinator.getUser().getFullname()));
        return ResponseEntity.ok(out);
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }

    /**
     * Pangalan ng semester, hal. "First Semester, 2026-2027". Gumagamit ng reflection para hindi
     * umasa sa eksaktong pangalan ng getter ng Semester entity; palitan ito ng diretsong getter kung gusto.
     */
    private static String semesterLabel(Semester semester) {
        if (semester == null) return "";
        String term = reflect(semester, "getSemester", "getName", "getTerm");
        String year = reflect(semester, "getSchoolYear", "getAcademicYear", "getYear");
        if (term.isEmpty()) return year;
        return year.isEmpty() ? term : term + ", " + year;
    }

    private static String reflect(Object target, String... getters) {
        for (String g : getters) {
            try {
                Object v = target.getClass().getMethod(g).invoke(target);
                if (v != null && !v.toString().isBlank()) return v.toString().trim();
            } catch (ReflectiveOperationException ignored) {
                // sinubukan ang susunod na pangalan
            }
        }
        return "";
    }

    /** Magpadala ng hiling. Sagot: state = submitted | pending (nag-enroll na) | active (may account na) */
    @PostMapping("/claim")
    @Transactional
    public ResponseEntity<?> claim(@RequestBody ClaimRequest r, HttpServletRequest http) {
        if (r == null) return bad("Fill in the form.");
        String ip = http.getRemoteAddr();
        if (blocked(ip)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again in a few minutes.");
        }

        EnrollmentLink link = r.token() == null ? null : links.findByToken(r.token()).orElse(null);
        if (link == null) return ResponseEntity.status(410).body("This link isn't valid. Ask your coordinator for the correct one.");
        String status = statusOf(link);
        if (status.equals("closed")) return ResponseEntity.status(410).body("Enrollment is closed. Please contact your coordinator.");
        if (status.equals("expired")) return ResponseEntity.status(410).body("The enrollment deadline has passed. Please contact your coordinator.");

        String number = r.studentNumber() == null ? "" : r.studentNumber().trim();
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        if (number.isEmpty() || number.length() > 50) return bad("Enter your Student ID.");
        if (email.isEmpty() || email.length() > 255 || !EMAIL.matcher(email).matches()) {
            return bad("Enter a valid email.");
        }

        List<Student> found = repository.findByNumber(number, link.getSemester().getId(), link.getCoordinator().getId());
        Student s = found.isEmpty() ? null : found.get(0);
        if (s == null || Boolean.TRUE.equals(s.getIsArchived())) {
            fail(ip);
            return ResponseEntity.status(404).body(
                    "We couldn't find that Student ID in this class list. Check the ID, or ask your coordinator.");
        }

        // Nag-enroll na o may account na: ipaalam nang malinaw, hindi ito error
        if (s.getEmail() != null && !s.getEmail().isBlank()) {
            return ResponseEntity.ok(Map.of("state", "active"));
        }
        if (requests.findPendingByStudent(s.getId()).isPresent()) {
            return ResponseEntity.ok(Map.of("state", "pending"));
        }

        if (repository.emailExists(email) || requests.pendingEmailExists(email)) {
            fail(ip);
            return ResponseEntity.status(409).body("That email is already used by another student.");
        }

        EnrollmentRequest req = new EnrollmentRequest();
        req.setCoordinator(link.getCoordinator());
        req.setSemester(link.getSemester());
        req.setStudent(s);
        req.setEmail(email);
        requests.save(req);

        return ResponseEntity.ok(Map.of("state", "submitted"));
    }

    // ---------------------------------------------------------------------

    private String statusOf(EnrollmentLink link) {
        if (!link.isOpen()) return "closed";
        return EnrollmentLinkController.isActive(link) ? "open" : "expired";
    }

    private synchronized boolean blocked(String ip) {
        Deque<Long> list = failures.get(ip);
        if (list == null) return false;
        long cutoff = System.currentTimeMillis() - WINDOW_MS;
        while (!list.isEmpty() && list.peekFirst() < cutoff) list.pollFirst();
        if (list.isEmpty()) failures.remove(ip);
        return list.size() >= MAX_FAILURES;
    }

    private synchronized void fail(String ip) {
        failures.computeIfAbsent(ip, k -> new ArrayDeque<>()).addLast(System.currentTimeMillis());
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
