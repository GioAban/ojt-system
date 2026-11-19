package com.iodev.practicum.controller;

import com.iodev.practicum.dto.RegistrationDtos.RegisterRequest;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EnrollmentLink;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import com.iodev.practicum.repository.EnrollmentLinkRepository;
import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.model.EmailToken;
import com.iodev.practicum.service.EmailTokenService;
import com.iodev.practicum.service.FieldErrors;
import com.iodev.practicum.service.RegistrationEmailService;
import com.iodev.practicum.service.PrivacySettings;
import com.iodev.practicum.service.RegistrationService;
import com.iodev.practicum.service.StudentProfileService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Supplier;

/**
 * PUBLIC na endpoint ng registration link (/api/enroll/** ay permitAll sa SecurityConfig).
 * Gumagawa ito ng StudentRegistration na EMAIL_PENDING at nagpapadala ng link sa email; ang Student ay nagagawa
 * kapag binuksan ang link (o kapag in-approve ng coordinator, kung naka-on ang "Also require my approval").
 * Proteksyon: honeypot, limit kada IP, at pagsusuri sa server. Walang ibinabalik na datos ng ibang student.
 */
@RestController
@RequestMapping("/api/enroll")
public class EnrollmentController {

    // Hangganan kada IP: ilang matagumpay na registration, at ilang maling subok.
    // Maluwag ito dahil iisang IP ang buong klase sa campus Wi-Fi kapag sabay-sabay nag-scan ng QR.
    private static final int MAX_SUCCESS = 60;
    private static final long SUCCESS_WINDOW_MS = 60 * 60_000;
    private static final int MAX_FAILURES = 30;
    private static final long FAILURE_WINDOW_MS = 10 * 60_000;
    private static final int MAX_TRACKED_IPS = 10_000;

    private final Map<String, Deque<Long>> successes = new HashMap<>();
    private final Map<String, Deque<Long>> failures = new HashMap<>();

    @Autowired private EnrollmentLinkRepository links;
    @Autowired private StudentRegistrationRepository registrations;
    @Autowired private RegistrationService registrationService;
    @Autowired private StudentProfileService profiles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PrivacySettings privacySettings;
    @Autowired private RegistrationEmailService registrationEmails;
    @Autowired private EmailTokenService emailTokens;

    /** Status ng link at detalye (college, program, semester, coordinator, course) para sa registration page */
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
        out.put("collegeLogo", logoPath(college));
        out.put("program", program == null ? "" : nz(program.getName()));
        out.put("programAbbreviation", program == null ? "" : nz(program.getAbbreviation()));
        out.put("course", courseFor(coordinator));
        out.put("semester", semesterLabel(link.getSemester()));
        out.put("coordinator", coordinator.getUser() == null ? "" : nz(coordinator.getUser().getFullname()));
        return ResponseEntity.ok(out);
    }

    /** Magparehistro. Sagot: {state: "submitted"} o error na may fieldErrors */
    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> register(@RequestBody RegisterRequest r, HttpServletRequest http) {
        String ip = http.getRemoteAddr();
        if (blocked(ip)) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        if (r == null) return ResponseEntity.badRequest().body("Fill in the form.");

        // Honeypot: tao ay hindi nakakakita ng field na ito. Kunwaring tagumpay, walang sine-save.
        if (r.website() != null && !r.website().isBlank()) {
            fail(ip);
            return ResponseEntity.ok(Map.of("state", "submitted"));
        }

        EnrollmentLink link = r.token() == null || r.token().isBlank() ? null
                : links.findByToken(r.token().trim()).orElse(null);
        if (link == null) {
            fail(ip);
            return ResponseEntity.status(410).body("This link isn't valid. Ask your coordinator for the correct one.");
        }
        String status = statusOf(link);
        if (status.equals("closed")) {
            return ResponseEntity.status(410).body("Registration is closed. Please contact your coordinator.");
        }
        if (status.equals("expired")) {
            return ResponseEntity.status(410).body("The registration deadline has passed. Please contact your coordinator.");
        }

        // Pagsusuri bawat field (parehong mensahe sa form)
        FieldErrors errors = new FieldErrors();
        String number = field(errors, "studentNumber", () -> profiles.validNumber(r.studentNumber()));
        String last = field(errors, "lastname", () -> registrationService.name(r.lastname(), "Last name"));
        String first = field(errors, "firstname", () -> registrationService.name(r.firstname(), "First name"));
        String mi = field(errors, "middleInitial", () -> registrationService.initial(r.middleInitial()));
        String year = field(errors, "year", () -> registrationService.year(r.year()));
        String gender = field(errors, "gender", () -> registrationService.gender(r.gender()));
        String email = field(errors, "email", () -> profiles.validEmail(r.email()));
        String pw = registrationService.passwordProblem(r.password(), r.confirmPassword(), number);
        if (pw != null) {
            errors.add(pw.startsWith("Passwords don't") ? "confirmPassword" : "password", pw);
        }
        if (!Boolean.TRUE.equals(r.privacyAccepted())) {
            errors.add("privacyAccepted", "Please read and accept the Privacy Notice.");
        }
        if (!errors.isEmpty()) {
            fail(ip);
            return errors.toResponse();
        }

        Long semesterId = link.getSemester().getId();
        if (registrationService.numberTaken(number, semesterId, null)) {
            fail(ip);
            return conflict("studentNumber", RegistrationService.NUMBER_TAKEN);
        }
        if (registrationService.emailTaken(email, null)) {
            fail(ip);
            return conflict("email", RegistrationService.EMAIL_TAKEN);
        }

        // Ang lumang hindi pa na-verify na registration ng parehong email ay pinapalitan (luma ang link nito)
        for (StudentRegistration old : registrations.findUnverifiedByEmail(email)) {
            emailTokens.closeAll(EmailToken.REGISTRATION, old.getId(), EmailToken.VERIFY_REGISTRATION);
            registrations.delete(old);
        }

        Coordinator coordinator = link.getCoordinator();
        StudentRegistration reg = new StudentRegistration();
        reg.setStatus(StudentRegistration.EMAIL_PENDING);
        reg.setCoordinator(coordinator);
        reg.setSemester(link.getSemester());
        reg.setLink(link);
        reg.setStudentNumber(number);
        reg.setLastname(last);
        reg.setFirstname(first);
        reg.setMiddleInitial(mi);
        reg.setYear(year);
        reg.setGender(gender);
        reg.setCourse(courseFor(coordinator)); // galing sa program, hindi sa client
        reg.setEmail(email);
        reg.setPasswordHash(passwordEncoder.encode(r.password()));
        reg.setPrivacyAckAt(LocalDateTime.now());
        reg.setPrivacyAckVersion(privacySettings.getNoticeVersion());
        registrations.save(reg);
        succeed(ip);

        // Link sa email (sa background, pagkatapos ng commit). Kapag lampas sa hangganan ng address na ito,
        // walang ipinapadala pero pareho pa rin ang sagot. Ang abiso sa coordinator ay kapag na-verify na ang email.
        registrationEmails.sendVerification(reg);

        return ResponseEntity.ok(Map.of("state", "submitted"));
    }

    // ---------------------------------------------------------------------

    private String field(FieldErrors errors, String key, Supplier<String> check) {
        try {
            return check.get();
        } catch (ActionException e) {
            errors.add(key, e.getMessage());
            return null;
        }
    }

    private ResponseEntity<?> conflict(String field, String message) {
        return ResponseEntity.status(409).body(Map.of("message", message, "fieldErrors", Map.of(field, message)));
    }

    /** Acronym ng program ng coordinator; ito ang course ng bagong student */
    static String courseFor(Coordinator coordinator) {
        Program p = coordinator.getProgram();
        if (p != null && p.getAbbreviation() != null && !p.getAbbreviation().isBlank()) return p.getAbbreviation().trim();
        return "OJT";
    }

    private static String logoPath(College c) {
        if (c == null || c.getLogo() == null || c.getLogo().isBlank()) return "";
        return "/public/colleges/" + c.getId() + "/logo?v=" + (c.getUpdatedAt() == null ? 0 : c.getUpdatedAt().getTime());
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }

    /** Pangalan ng semester, hal. "First Semester, 2026-2027" */
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

    private String statusOf(EnrollmentLink link) {
        if (!link.isOpen()) return "closed";
        return EnrollmentLinkController.isActive(link) ? "open" : "expired";
    }

    private synchronized boolean blocked(String ip) {
        return count(failures, ip, FAILURE_WINDOW_MS) >= MAX_FAILURES
                || count(successes, ip, SUCCESS_WINDOW_MS) >= MAX_SUCCESS;
    }

    private synchronized void fail(String ip) {
        record(failures, ip);
    }

    private synchronized void succeed(String ip) {
        record(successes, ip);
    }

    private static int count(Map<String, Deque<Long>> map, String ip, long windowMs) {
        Deque<Long> list = map.get(ip);
        if (list == null) return 0;
        long cutoff = System.currentTimeMillis() - windowMs;
        while (!list.isEmpty() && list.peekFirst() < cutoff) list.pollFirst();
        if (list.isEmpty()) map.remove(ip);
        return list.size();
    }

    private static void record(Map<String, Deque<Long>> map, String ip) {
        // Huwag hayaang lumaki nang walang hangganan ang memorya
        if (map.size() >= MAX_TRACKED_IPS && !map.containsKey(ip)) map.clear();
        map.computeIfAbsent(ip, k -> new ArrayDeque<>()).addLast(System.currentTimeMillis());
    }
}
