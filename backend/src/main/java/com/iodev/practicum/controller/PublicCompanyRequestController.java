package com.iodev.practicum.controller;

import com.iodev.practicum.service.FieldErrors;
import com.iodev.practicum.dto.CompanyRequestDtos.LinkRequestInput;
import com.iodev.practicum.service.CompanyLinkRequestService;
import com.iodev.practicum.service.CoordinatorNotifier;
import jakarta.servlet.http.HttpServletRequest;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanyRequestLink;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CompanyRequestLinkRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * PUBLIC na endpoint ng link ng company (walang account). Nasa ilalim ng /api/public/**, na permitAll na.
 * Ang isinumite ay nagiging bagong Company na "pending" (nakatago sa lahat ng listahan) kasama ang mga
 * department nito; ang coordinator ang mag-aayos, mag-a-approve, magme-merge o magre-reject sa Requests tab.
 */
@RestController
@RequestMapping("/api/public/company-requests")
public class PublicCompanyRequestController {

    /** Palitan kapag binago ang teksto ng Data Privacy Notice sa page (para may rekord kung alin ang pinayagan) */
    public static final String PRIVACY_VERSION = "2026-10";

    // Hangganan ng pagsubok kada IP (public ang form). Ang IP ay galing sa getRemoteAddr(): tama na ito sa likod
    // ng Caddy (server.forward-headers-strategy=native), at hindi mapepeke gamit ang sariling X-Forwarded-For.
    private static final int MAX_SUBMITS = 20; // kasama ang mga subok na may mali, kaya hindi masyadong mahigpit
    private static final long WINDOW_MS = 60 * 60_000L;
    private final Map<String, Deque<Long>> hits = new HashMap<>();

    @Autowired private CompanyRequestLinkRepository links;
    @Autowired private CompanyLinkRequestService requests;
    @Autowired private CoordinatorNotifier coordinatorNotifier;
    @PersistenceContext private EntityManager em;

    /** Status ng link at detalye ng portal para sa page ng company. Walang listahan ng ibang company dito. */
    @GetMapping("/info")
    @Transactional(readOnly = true)
    public ResponseEntity<?> info(@RequestParam String token) {
        CompanyRequestLink link = links.findByToken(token).orElse(null);
        if (link == null) return ResponseEntity.ok(Map.of("status", "invalid"));

        Coordinator coordinator = link.getCoordinator();
        Program program = coordinator.getProgram();
        College college = program == null ? null : program.getCollege();

        Map<String, Object> out = new LinkedHashMap<>();
        String status = statusOf(link);
        out.put("status", status);
        out.put("dueDate", link.getDueDate() == null ? "" : link.getDueDate().toString());
        out.put("college", college == null ? "" : nz(college.getName()));
        out.put("collegeAbbreviation", college == null ? "" : nz(college.getAbbreviation()));
        out.put("program", program == null ? "" : nz(program.getName()));
        out.put("programAbbreviation", program == null ? "" : nz(program.getAbbreviation()));
        out.put("semester", semesterLabel(link.getSemester()));
        out.put("coordinator", coordinator.getUser() == null ? "" : nz(coordinator.getUser().getFullname()));
        out.put("privacyVersion", PRIVACY_VERSION);

        List<Map<String, Object>> natures = new ArrayList<>();
        if (status.equals("open")) {
            List<Object[]> rows = em.createQuery("select n.id, n.name from CompanyNature n order by n.name", Object[].class)
                    .getResultList();
            for (Object[] row : rows) {
                Map<String, Object> n = new LinkedHashMap<>();
                n.put("id", row[0]);
                n.put("name", row[1] == null ? "" : row[1].toString());
                natures.add(n);
            }
        }
        out.put("natures", natures);
        return ResponseEntity.ok(out);
    }

    /** JSON lang (walang file). Walang ibinabalik na impormasyon tungkol sa ibang company. */
    @PostMapping("/submit")
    @Transactional
    public ResponseEntity<?> submit(@RequestBody LinkRequestInput b, HttpServletRequest http) {
        if (b == null) return bad("Fill in the form.");
        if (!allow(http.getRemoteAddr())) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        // Honeypot: ang tao ay hindi pumupuno ng nakatagong field. Huwag sabihin sa bot na nahuli ito.
        if (b.website() != null && !b.website().isBlank()) {
            return ResponseEntity.ok(Map.of("state", "submitted"));
        }

        CompanyRequestLink link = b.token() == null ? null : links.findByToken(b.token()).orElse(null);
        if (link == null) return ResponseEntity.status(410).body("This link isn't valid. Ask the coordinator for the correct one.");
        String status = statusOf(link);
        if (status.equals("closed")) return ResponseEntity.status(410).body("This form is closed. Please contact the coordinator.");
        if (status.equals("expired")) return ResponseEntity.status(410).body("The deadline has passed. Please contact the coordinator.");

        FieldErrors errors = requests.validate(b, true);
        if (!errors.isEmpty()) return errors.toResponse();

        Company company = requests.createPending(link, b, PRIVACY_VERSION);

        Coordinator coordinator = link.getCoordinator();
        String message = company.getName() + ". Immediate supervisor: " + company.getImsupFullname()
                + ", " + company.getImsupContactNumber();
        coordinatorNotifier.toCoordinator(coordinator.getId(), "company_request", "New company request",
                message.length() > 480 ? message.substring(0, 480) : message,
                "/coordinator/host-training-establishments?tab=requests");

        return ResponseEntity.ok(Map.of("state", "submitted"));
    }

    // ---------------------------------------------------------------------

    private String statusOf(CompanyRequestLink link) {
        if (!link.isOpen()) return "closed";
        return CompanyRequestLinkController.isActive(link) ? "open" : "expired";
    }

    private synchronized boolean allow(String ip) {
        long now = System.currentTimeMillis();
        if (hits.size() > 5000) hits.clear();
        Deque<Long> list = hits.computeIfAbsent(ip, k -> new ArrayDeque<>());
        while (!list.isEmpty() && list.peekFirst() < now - WINDOW_MS) list.pollFirst();
        if (list.size() >= MAX_SUBMITS) return false;
        list.addLast(now);
        return true;
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }

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

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
