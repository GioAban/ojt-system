package com.iodev.practicum.controller;

import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanyNature;
import com.iodev.practicum.model.CompanyRequestLink;
import com.iodev.practicum.model.CoordinatorNotification;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CompanyRequestLinkRepository;
import com.iodev.practicum.repository.CoordinatorNotificationRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.service.CompanyMatch;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * PUBLIC na endpoint ng link ng company (walang account). Nasa ilalim ng /api/public/**, na permitAll na.
 * Ang isinumite ay nagiging Company + Department na "pending" na walang student; ang coordinator
 * pa rin ang mag-aapprove o magde-decline sa Company requests tab.
 */
@RestController
@RequestMapping("/api/public/company-requests")
public class PublicCompanyRequestController {

    /** Palitan kapag binago ang teksto ng Data Privacy Notice sa page (para may rekord kung alin ang pinayagan) */
    public static final String PRIVACY_VERSION = "2026-10";

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE = Pattern.compile("^[0-9+()\\-\\s]{7,20}$");

    // Hangganan ng pagsubok kada IP (public ang form)
    private static final int MAX_SUBMITS = 8;
    private static final long WINDOW_MS = 60 * 60_000L;
    private static final int MAX_DEPARTMENTS = 5;
    private final Map<String, Deque<Long>> hits = new HashMap<>();

    public record DepartmentInput(String name, Integer slots) {}

    public record SubmitBody(String token, String companyName, Long natureId, String address, String location,
                             String companyContactNumber, String contactFullname, String contactPosition,
                             String contactEmail, String contactNumber, List<DepartmentInput> departments,
                             Boolean consent, String website) {}

    @Autowired private CompanyRequestLinkRepository links;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private CoordinatorNotificationRepository notifications;
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

    @PostMapping("/submit")
    @Transactional
    public ResponseEntity<?> submit(@RequestBody SubmitBody b, HttpServletRequest http) {
        if (b == null) return bad("Fill in the form.");
        if (!allow(clientIp(http))) {
            return ResponseEntity.status(429).body("Too many attempts. Please try again later.");
        }
        // Honeypot: ang tao ay hindi pumupuno ng nakatagong field. Huwag sabihin sa bot na nahuli ito.
        if (b.website() != null && !b.website().isBlank()) {
            return ResponseEntity.ok(Map.of("state", "submitted", "departments", 0));
        }

        CompanyRequestLink link = b.token() == null ? null : links.findByToken(b.token()).orElse(null);
        if (link == null) return ResponseEntity.status(410).body("This link isn't valid. Ask the coordinator for the correct one.");
        String status = statusOf(link);
        if (status.equals("closed")) return ResponseEntity.status(410).body("This form is closed. Please contact the coordinator.");
        if (status.equals("expired")) return ResponseEntity.status(410).body("The deadline has passed. Please contact the coordinator.");

        if (!Boolean.TRUE.equals(b.consent())) return bad("Please agree to the Data Privacy Notice to continue.");

        String companyName = clean(b.companyName());
        String address = clean(b.address());
        String location = clean(b.location());
        String companyContact = clean(b.companyContactNumber());
        String contactFullname = clean(b.contactFullname());
        String contactPosition = clean(b.contactPosition());
        String contactEmail = clean(b.contactEmail()).toLowerCase();
        String contactNumber = clean(b.contactNumber());

        if (companyName.isEmpty() || companyName.length() > 255) return bad("Enter the company name.");
        if (address.isEmpty() || address.length() > 255) return bad("Enter the company address.");
        if (location.length() > 255) return bad("The location is too long.");
        if (!PHONE.matcher(companyContact).matches()) return bad("Enter a valid company contact number.");
        if (contactFullname.isEmpty() || contactFullname.length() > 255) return bad("Enter the contact person's name.");
        if (contactPosition.length() > 255) return bad("The position is too long.");
        if (!contactEmail.isEmpty() && (contactEmail.length() > 255 || !EMAIL.matcher(contactEmail).matches())) {
            return bad("Enter a valid email or leave it blank.");
        }
        if (!PHONE.matcher(contactNumber).matches()) return bad("Enter a valid contact number for the contact person.");
        if (b.natureId() == null) return bad("Select the nature of the company.");

        CompanyNature nature = em.find(CompanyNature.class, b.natureId());
        if (nature == null) return bad("Select the nature of the company.");

        List<DepartmentInput> inputs = b.departments() == null ? List.of() : b.departments();
        if (inputs.isEmpty()) return bad("Add at least one department or unit.");
        if (inputs.size() > MAX_DEPARTMENTS) return bad("You can add up to " + MAX_DEPARTMENTS + " departments at a time.");
        for (DepartmentInput in : inputs) {
            String dn = in == null ? "" : clean(in.name());
            if (dn.isEmpty() || dn.length() > 255) return bad("Enter the name of each department or unit.");
            if (in.slots() != null && (in.slots() < 1 || in.slots() > 99)) return bad("Slots must be between 1 and 99.");
        }

        Coordinator coordinator = link.getCoordinator();
        Semester semester = link.getSemester();

        // Kung nasa listahan na ang company (parehong pangalan), idagdag lang ang department nito
        Company company = null;
        String wanted = CompanyMatch.normalize(companyName);
        for (Company c : companyRepository.findAllForManagement(coordinator.getId(), semester.getId())) {
            if (Boolean.TRUE.equals(c.getIsArchived())) continue;
            if (CompanyMatch.normalize(c.getName()).equals(wanted)) {
                company = c;
                break;
            }
        }
        if (company == null) {
            company = new Company();
            company.setCoordinator(coordinator);
            company.setSemester(semester);
            company.setName(companyName);
            company.setAddress(address);
            company.setLocation(location.isEmpty() ? null : location);
            company.setContactNumber(companyContact);
            company.setImsupFullname(contactFullname);
            company.setImsupPosition(contactPosition.isEmpty() ? "N/A" : contactPosition);
            company.setNature(nature);
            company = companyRepository.save(company);
        }

        List<Department> existing = departmentRepository.findActiveByCompanyIds(List.of(company.getId()));
        List<String> seen = new ArrayList<>();
        int created = 0;
        for (DepartmentInput in : inputs) {
            final String dn = clean(in.name());
            boolean duplicate = seen.stream().anyMatch(s -> CompanyMatch.sameDepartment(s, dn))
                    || existing.stream().anyMatch(d -> !"declined".equalsIgnoreCase(d.getStatus())
                    && CompanyMatch.sameDepartment(d.getName(), dn));
            if (duplicate) continue; // tahimik na nilalaktawan; hindi ibinubunyag kung ano ang nasa listahan
            seen.add(dn);

            Department d = new Department();
            d.setCompany(company);
            d.setName(dn);
            d.setSlots(in.slots() == null ? 1 : in.slots());
            d.setStatus("pending");
            d.setRequestedByStudentId(null);
            d.setSupervisorFullname(contactFullname);
            d.setSupervisorPosition(contactPosition.isEmpty() ? null : contactPosition);
            d.setSupervisorEmail(contactEmail.isEmpty() ? null : contactEmail);
            d.setSupervisorContactNumber(contactNumber);
            d.setRequestSource("company_link");
            d.setPrivacyConsentAt(LocalDateTime.now());
            d.setPrivacyNoticeVersion(PRIVACY_VERSION);
            departmentRepository.save(d);
            created++;
        }

        if (created > 0) {
            // Abiso sa bell ng coordinator
            String first = seen.get(0);
            String what = created == 1 ? first : first + " (+" + (created - 1) + " more)";
            String message = company.getName() + " – " + what + ". Contact: " + contactFullname + ", " + contactNumber;
            notifications.save(new CoordinatorNotification(
                    coordinator.getId(), null, "company_request",
                    "New company request",
                    message.length() > 480 ? message.substring(0, 480) : message,
                    "/coordinator/host-training-establishments?tab=requests"));
        }

        return ResponseEntity.ok(Map.of("state", "submitted", "departments", created));
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

    /** Nasa likod ng Caddy sa production: ang tunay na IP ay nasa X-Forwarded-For */
    private static String clientIp(HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return http.getRemoteAddr();
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim().replaceAll("\\s+", " ");
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
