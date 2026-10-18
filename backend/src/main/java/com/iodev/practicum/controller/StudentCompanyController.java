package com.iodev.practicum.controller;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanyApplication;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyApplicationRepository;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.service.CompanyMatch;
import com.iodev.practicum.service.CoordinatorNotifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Para sa student: mag-apply sa department ng company, humiling ng company/department na wala sa listahan,
 * at tingnan kung duplicate bago magpadala. Approved lang ang pwedeng gumawa nito.
 */
@RestController
@RequestMapping("/api/student/company")
public class StudentCompanyController {

    private static final int MAX_PENDING_APPLICATIONS = 3;
    private static final int MAX_PENDING_REQUESTS = 3;

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CompanyApplicationRepository applicationRepository;
    @Autowired private CoordinatorNotifier coordinatorNotifier;

    // ---------------------------------------------------------------------
    // DTOs
    // ---------------------------------------------------------------------

    public record ApplicationRow(Long id, Long departmentId, String companyName, String departmentName,
                                 String status, String declineReason, String createdAt) {}

    public record RequestRow(Long departmentId, String companyName, String departmentName, String status,
                             String declineReason, String createdAt) {}

    public record Overview(String status, boolean canApply, boolean accepting, boolean deployed,
                           String deployedCompany, String deployedDepartment,
                           int maxApplications, List<ApplicationRow> applications, List<RequestRow> requests) {}

    public record ApplyBody(Long departmentId) {}

    public record CheckBody(String companyName, String departmentName) {}

    public record MatchDepartment(Long id, String name, String status) {}

    public record MatchCompany(Long companyId, String name, String address, boolean listed,
                               boolean sameDepartment, List<MatchDepartment> departments) {}

    public record CheckResult(List<MatchCompany> matches, boolean exactDuplicate) {}

    public record NewRequestBody(Long existingCompanyId, String companyName, String address, String contactNumber,
                              String location, String departmentName, String supervisorFullname,
                              String supervisorPosition, String supervisorEmail, String supervisorContactNumber,
                              Boolean confirmDifferent) {}

    // ---------------------------------------------------------------------
    // Overview
    // ---------------------------------------------------------------------

    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public ResponseEntity<?> overview(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");

        Coordinator coordinator = s.getCoordinator();
        boolean accepting = coordinator == null || !Boolean.FALSE.equals(coordinator.getAcceptingCompanyRequests());

        Department placed = s.getDepartment();
        List<ApplicationRow> apps = new ArrayList<>();
        List<CompanyApplication> mine = applicationRepository.findByStudentIdOrderByCreatedAtDesc(s.getId());
        Map<Long, Department> depts = new HashMap<>();
        for (Department d : departmentRepository.findAllById(
                mine.stream().map(CompanyApplication::getDepartmentId).distinct().toList())) {
            depts.put(d.getId(), d);
        }
        for (CompanyApplication a : mine) {
            Department d = depts.get(a.getDepartmentId());
            apps.add(new ApplicationRow(a.getId(), a.getDepartmentId(),
                    d == null ? "(removed)" : d.getCompany().getName(),
                    d == null ? "" : deptLabel(d.getName()),
                    a.getStatus().toLowerCase(), a.getDeclineReason(), a.getCreatedAt().toString()));
        }

        List<RequestRow> requests = new ArrayList<>();
        if (coordinator != null && s.getSemester() != null) {
            List<Company> companies = companyRepository.findAllForManagement(coordinator.getId(), s.getSemester().getId());
            if (!companies.isEmpty()) {
                for (Department d : departmentRepository.findAllByCompanyIds(companies.stream().map(Company::getId).toList())) {
                    if (!s.getId().equals(d.getRequestedByStudentId())) continue;
                    requests.add(new RequestRow(d.getId(), d.getCompany().getName(), deptLabel(d.getName()),
                            d.getStatus().toLowerCase(), d.getDeclineReason(),
                            d.getCreatedAt() == null ? null : d.getCreatedAt().toLocalDateTime().toString()));
                }
                requests.sort(Comparator.comparing(RequestRow::departmentId).reversed());
            }
        }

        return ResponseEntity.ok(new Overview(
                s.getStatus() == null ? "" : s.getStatus(), canApply(s), accepting,
                isDeployed(s),
                placed == null ? null : placed.getCompany().getName(),
                placed == null ? null : deptLabel(placed.getName()),
                MAX_PENDING_APPLICATIONS, apps, requests));
    }

    // ---------------------------------------------------------------------
    // Apply
    // ---------------------------------------------------------------------

    @PostMapping("/applications")
    @Transactional
    public ResponseEntity<?> apply(@RequestBody ApplyBody body, Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (!canApply(s)) return ResponseEntity.status(409).body("You can only apply once your status is Approved.");
        if (body == null || body.departmentId() == null) return bad("Pick a department to apply to.");

        Department d = departmentRepository.findById(body.departmentId()).orElse(null);
        if (d == null || Boolean.TRUE.equals(d.getIsArchived()) || !"approved".equalsIgnoreCase(d.getStatus())
                || Boolean.TRUE.equals(d.getCompany().getIsArchived())) {
            return ResponseEntity.status(404).body("That department isn't available.");
        }
        if (!sameOwner(s, d.getCompany())) return ResponseEntity.status(403).body("That company isn't in your list.");

        if (applicationRepository.existsByStudentIdAndDepartmentIdAndStatus(
                s.getId(), d.getId(), CompanyApplication.PENDING)) {
            return ResponseEntity.status(409).body("You already applied to this department.");
        }
        if (applicationRepository.countByStudentIdAndStatus(s.getId(), CompanyApplication.PENDING)
                >= MAX_PENDING_APPLICATIONS) {
            return ResponseEntity.status(409).body("You can have up to " + MAX_PENDING_APPLICATIONS
                    + " pending applications. Cancel one first.");
        }
        int filled = filled(d);
        if (d.getSlots() != null && filled >= d.getSlots()) {
            return ResponseEntity.status(409).body("This department has no open slots.");
        }

        CompanyApplication a = applicationRepository.save(new CompanyApplication(s.getId(), d.getId()));

        coordinatorNotifier.fromStudent(s, "company_application", "New company application",
                fullName(s) + " applied to " + d.getCompany().getName() + " – " + deptLabel(d.getName()) + ".",
                "/coordinator/students?tab=applications");

        return ResponseEntity.ok(new ApplicationRow(a.getId(), d.getId(), d.getCompany().getName(),
                deptLabel(d.getName()), "pending", null, a.getCreatedAt().toString()));
    }

    @DeleteMapping("/applications/{id}")
    @Transactional
    public ResponseEntity<?> cancel(@PathVariable Long id, Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        CompanyApplication a = applicationRepository.findById(id).orElse(null);
        if (a == null || !a.getStudentId().equals(s.getId())) return ResponseEntity.notFound().build();
        if (!CompanyApplication.PENDING.equals(a.getStatus())) {
            return ResponseEntity.status(409).body("This application was already reviewed.");
        }
        a.setStatus(CompanyApplication.CANCELLED);
        a.setReviewedAt(java.time.LocalDateTime.now());
        applicationRepository.save(a);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------------
    // Duplicate check (bago magpadala ng request)
    // ---------------------------------------------------------------------

    @PostMapping("/check")
    @Transactional(readOnly = true)
    public ResponseEntity<?> check(@RequestBody CheckBody body, Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (s.getCoordinator() == null || s.getSemester() == null || body == null) {
            return ResponseEntity.ok(new CheckResult(List.of(), false));
        }
        return ResponseEntity.ok(findMatches(s, body.companyName(), body.departmentName()));
    }

    private CheckResult findMatches(Student s, String companyName, String departmentName) {
        List<MatchCompany> matches = new ArrayList<>();
        boolean exact = false;
        if (companyName == null || companyName.isBlank()) return new CheckResult(matches, false);

        List<Company> companies = companyRepository.findForAssignment(
                s.getCoordinator().getId(), s.getSemester().getId());
        List<Company> similar = companies.stream()
                .filter(c -> CompanyMatch.similar(c.getName(), companyName)).toList();
        if (similar.isEmpty()) return new CheckResult(matches, false);

        Map<Long, List<Department>> byCompany = new HashMap<>();
        for (Department d : departmentRepository.findActiveByCompanyIds(similar.stream().map(Company::getId).toList())) {
            if ("declined".equalsIgnoreCase(d.getStatus())) continue;
            byCompany.computeIfAbsent(d.getCompany().getId(), k -> new ArrayList<>()).add(d);
        }

        for (Company c : similar) {
            List<Department> deps = byCompany.getOrDefault(c.getId(), List.of());
            boolean listed = deps.stream().anyMatch(d -> "approved".equalsIgnoreCase(d.getStatus()));
            boolean sameDept = departmentName != null && deps.stream()
                    .anyMatch(d -> CompanyMatch.sameDepartment(d.getName(), departmentName));
            if (sameDept) exact = true;
            matches.add(new MatchCompany(c.getId(), c.getName(), c.getAddress(), listed, sameDept,
                    deps.stream().map(d -> new MatchDepartment(d.getId(), deptLabel(d.getName()),
                            d.getStatus().toLowerCase())).toList()));
        }
        return new CheckResult(matches, exact);
    }

    // ---------------------------------------------------------------------
    // Request a new company / department
    // ---------------------------------------------------------------------

    @PostMapping("/requests")
    @Transactional
    public ResponseEntity<?> request(@RequestBody NewRequestBody body, Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (!canApply(s)) return ResponseEntity.status(409).body("You can only send a request once your status is Approved.");
        Coordinator coordinator = s.getCoordinator();
        if (coordinator == null || s.getSemester() == null) return bad("You don't have a coordinator yet.");
        if (Boolean.FALSE.equals(coordinator.getAcceptingCompanyRequests())) {
            return ResponseEntity.status(409).body("Your coordinator isn't accepting new company requests right now.");
        }
        if (body == null) return bad("Missing details.");

        String companyName = clean(body.companyName());
        String deptName = clean(body.departmentName());
        if (deptName.isEmpty()) return bad("Department is required.");
        if (deptName.length() > 255) return bad("Department name is too long.");

        if (pendingRequests(s) >= MAX_PENDING_REQUESTS) {
            return ResponseEntity.status(409).body("You already have " + MAX_PENDING_REQUESTS
                    + " pending requests. Wait for your coordinator to review them.");
        }

        Company company;
        if (body.existingCompanyId() != null) {
            company = companyRepository.findById(body.existingCompanyId()).orElse(null);
            if (company == null || Boolean.TRUE.equals(company.getIsArchived()) || !sameOwner(s, company)) {
                return ResponseEntity.status(404).body("That company isn't in your list.");
            }
        } else {
            if (companyName.isEmpty()) return bad("Company name is required.");
            if (companyName.length() > 255) return bad("Company name is too long.");
            String address = clean(body.address());
            String contact = clean(body.contactNumber());
            if (address.isEmpty()) return bad("Company address is required.");
            if (contact.isEmpty()) return bad("Company contact number is required.");

            for (Company c : companyRepository.findForAssignment(coordinator.getId(), s.getSemester().getId())) {
                boolean same = CompanyMatch.normalize(c.getName()).equals(CompanyMatch.normalize(companyName));
                if (same || (CompanyMatch.similar(c.getName(), companyName)
                        && !Boolean.TRUE.equals(body.confirmDifferent()))) {
                    return ResponseEntity.status(409).body("\"" + c.getName()
                            + "\" is already in the list. Choose it and request the department instead.");
                }
            }
            company = new Company();
            company.setCoordinator(coordinator);
            company.setSemester(s.getSemester());
            company.setName(companyName);
            company.setAddress(address);
            company.setContactNumber(contact);
            String loc = clean(body.location());
            company.setLocation(loc.isEmpty() ? null : loc);
            String sup = clean(body.supervisorFullname());
            String pos = clean(body.supervisorPosition());
            company.setImsupFullname(sup.isEmpty() ? "N/A" : sup);
            company.setImsupPosition(pos.isEmpty() ? "N/A" : pos);
            company = companyRepository.save(company);
        }

        for (Department d : departmentRepository.findActiveByCompanyIds(List.of(company.getId()))) {
            if (!"declined".equalsIgnoreCase(d.getStatus()) && CompanyMatch.sameDepartment(d.getName(), deptName)) {
                return ResponseEntity.status(409).body("\"" + deptLabel(d.getName()) + "\" already exists in "
                        + company.getName() + ("pending".equalsIgnoreCase(d.getStatus())
                        ? " (waiting for the coordinator's review)." : ". Pick it from the list and apply."));
            }
        }

        Department d = new Department();
        d.setCompany(company);
        d.setName(deptName);
        d.setSlots(1);
        d.setStatus("pending");
        d.setRequestedByStudentId(s.getId());
        d.setSupervisorFullname(nullIfEmpty(body.supervisorFullname()));
        d.setSupervisorPosition(nullIfEmpty(body.supervisorPosition()));
        d.setSupervisorEmail(nullIfEmpty(body.supervisorEmail()));
        d.setSupervisorContactNumber(nullIfEmpty(body.supervisorContactNumber()));
        d = departmentRepository.save(d);

        coordinatorNotifier.fromStudent(s, "company_request", "New company request",
                fullName(s) + " requested " + company.getName() + " – " + deptLabel(d.getName())
                        + (body.existingCompanyId() == null ? " (new company)." : "."),
                "/coordinator/host-training-establishments");

        return ResponseEntity.ok(new RequestRow(d.getId(), company.getName(), deptLabel(d.getName()),
                "pending", null, java.time.LocalDateTime.now().toString()));
    }

    // ---------------------------------------------------------------------

    private long pendingRequests(Student s) {
        List<Company> companies = companyRepository.findAllForManagement(
                s.getCoordinator().getId(), s.getSemester().getId());
        if (companies.isEmpty()) return 0;
        return departmentRepository.findAllByCompanyIds(companies.stream().map(Company::getId).toList()).stream()
                .filter(d -> s.getId().equals(d.getRequestedByStudentId()) && "pending".equalsIgnoreCase(d.getStatus()))
                .count();
    }

    private int filled(Department d) {
        for (Object[] row : studentRepository.countByDepartmentIds(List.of(d.getId()))) {
            return ((Long) row[1]).intValue();
        }
        return 0;
    }

    private static boolean canApply(Student s) {
        String st = s.getStatus() == null ? "" : s.getStatus().trim();
        return "approved".equalsIgnoreCase(st);
    }

    private static boolean isDeployed(Student s) {
        String st = s.getStatus() == null ? "" : s.getStatus().trim();
        return "deployed".equalsIgnoreCase(st) || "completed".equalsIgnoreCase(st);
    }

    private static boolean sameOwner(Student s, Company c) {
        return s.getCoordinator() != null && s.getSemester() != null
                && c.getCoordinator().getId().equals(s.getCoordinator().getId())
                && c.getSemester().getId().equals(s.getSemester().getId());
    }

    private static String deptLabel(String name) {
        return name == null || name.isBlank() ? "N/A" : name;
    }

    private static String fullName(Student s) {
        return s.getFirstname() + " " + s.getLastname();
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim().replaceAll("\\s+", " ");
    }

    private static String nullIfEmpty(String v) {
        String c = clean(v);
        return c.isEmpty() ? null : c;
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
