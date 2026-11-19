package com.iodev.practicum.controller;

import com.iodev.practicum.service.SupervisorResolver;
import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.CompanyLinkRequestService;
import com.iodev.practicum.service.FieldErrors;
import com.iodev.practicum.repository.CompanyNatureRepository;
import org.springframework.data.domain.Sort;
import com.iodev.practicum.dto.CompanyRequestDtos.*;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentNotificationRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Mga company/department na ininput ng students. Ang idinagdag ng coordinator ay agad na
 * "approved". Ang hiling ng student ay "pending" hanggang i-approve o i-decline (may dahilan)
 * ng coordinator. Ang hiling mula sa company link ay buong company na sinusuri sa /link-requests.
 */
@RestController
@RequestMapping("/api/coordinator/company-requests")
public class CompanyRequestController {

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentNotificationRepository notificationRepository;
    @Autowired private CompanyLinkRequestService linkService;
    @Autowired private CompanyNatureRepository natureRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<Company> companies = companyRepository.findAllForManagement(coordinator.getId(), semesterId)
                .stream().filter(c -> !Boolean.TRUE.equals(c.getIsArchived())).toList();
        Map<Long, Company> byId = new HashMap<>();
        for (Company c : companies) byId.put(c.getId(), c);

        List<Department> requested = requestedDepartments(companies);

        // Ilang approved na department ang meron ang bawat company (para malaman kung bagong company)
        Map<Long, Integer> approvedPerCompany = new HashMap<>();
        if (!companies.isEmpty()) {
            for (Department d : departmentRepository.findAllByCompanyIds(byId.keySet())) {
                if ("approved".equalsIgnoreCase(d.getStatus()) && !Boolean.TRUE.equals(d.getIsArchived())
                        && d.getRequestedByStudentId() == null) {
                    approvedPerCompany.merge(d.getCompany().getId(), 1, Integer::sum);
                }
            }
        }

        requested.sort(Comparator
                .comparing((Department d) -> "pending".equalsIgnoreCase(d.getStatus()) ? 0 : 1)
                .thenComparing(Department::getId, Comparator.reverseOrder()));

        List<RequestRow> rows = new ArrayList<>();
        long pending = 0;
        for (Department d : requested) {
            Company c = byId.get(d.getCompany().getId());
            Student s = d.getRequestedByStudentId() == null
                    ? null
                    : studentRepository.findById(d.getRequestedByStudentId()).orElse(null);
            if ("pending".equalsIgnoreCase(d.getStatus())) pending++;

            rows.add(new RequestRow(
                    d.getId(), d.getStatus().toLowerCase(),
                    c.getId(), c.getName(), c.getAddress(), c.getContactNumber(), c.getLocation(),
                    approvedPerCompany.getOrDefault(c.getId(), 0) == 0,
                    d.getName(), d.getSlots(),
                    // Para sa bagong company, nasa company ang supervisor; kaya dumadaan sa resolver
                    SupervisorResolver.forDepartment(d).nameOrNull(),
                    SupervisorResolver.forDepartment(d).positionOrNull(),
                    SupervisorResolver.forDepartment(d).emailOrNull(),
                    SupervisorResolver.forDepartment(d).contactNumberOrNull(),
                    s == null ? null : s.getId(), s == null ? null : s.getStudentNumber(),
                    s == null ? null : s.getFirstname(), s == null ? null : s.getLastname(),
                    s == null ? null : s.getMiddleInitial(), s == null ? null : s.getSubjectCode(),
                    d.getDeclineReason(),
                    d.getReviewedAt() == null ? null : d.getReviewedAt().toString(),
                    sourceOf(d),
                    d.getPrivacyConsentAt() == null ? null : d.getPrivacyConsentAt().toString()));
        }

        // Bagong hiling mula sa company link: isa bawat company, nakatago sa lahat ng listahan hanggang ma-approve
        List<LinkRequestView> linkRequests = linkService.views(coordinator, semesterId);
        pending += linkRequests.stream().filter(r -> CompanyLinkRequestService.PENDING.equals(r.status())).count();
        List<NatureOption> natures = natureRepository.findAll(Sort.by("name")).stream()
                .map(n -> new NatureOption(n.getId(), n.getName())).toList();

        return ResponseEntity.ok(new RequestsResponse(
                semesterId, coordinator.getAcceptingCompanyRequests(), pending, rows, linkRequests, natures));
    }

    /** Para sa badge ng sidebar */
    @GetMapping("/pending-count")
    @Transactional(readOnly = true)
    public ResponseEntity<?> pendingCount(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<Company> companies = companyRepository.findAllForManagement(coordinator.getId(), semesterId)
                .stream().filter(c -> !Boolean.TRUE.equals(c.getIsArchived())).toList();
        long count = requestedDepartments(companies).stream()
                .filter(d -> "pending".equalsIgnoreCase(d.getStatus())).count()
                + companyRepository.countPendingLinkRequests(coordinator.getId(), semesterId);
        return ResponseEntity.ok(new PendingCount(count));
    }

    @PatchMapping("/settings")
    @Transactional
    public ResponseEntity<?> settings(@RequestBody SettingsRequest request, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        if (request == null || request.accepting() == null) return bad("Missing value.");

        coordinator.setAcceptingCompanyRequests(request.accepting());
        coordinatorRepository.save(coordinator);
        return ResponseEntity.ok(new SettingsResult(request.accepting()));
    }

    @PatchMapping("/{departmentId}/approve")
    @Transactional
    public ResponseEntity<?> approve(@PathVariable Long departmentId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department d = departmentRepository.findById(departmentId).orElse(null);
        ResponseEntity<?> problem = check(d, coordinator);
        if (problem != null) return problem;

        for (Department other : departmentRepository.findActiveByCompanyIds(List.of(d.getCompany().getId()))) {
            if (!other.getId().equals(d.getId()) && "approved".equalsIgnoreCase(other.getStatus())
                    && other.getName() != null && other.getName().equalsIgnoreCase(d.getName())) {
                return ResponseEntity.status(409).body(
                        "\"" + d.getName() + "\" already exists in " + d.getCompany().getName()
                                + ". Decline this request and tell the student to pick it from the list.");
            }
        }

        d.setStatus("approved");
        d.setReviewedAt(LocalDateTime.now());
        d.setDeclineReason(null);
        departmentRepository.save(d);

        notify(d, "COMPANY_REQUEST_APPROVED", "Your request was approved",
                d.getCompany().getName() + " – " + d.getName()
                        + " is now in the list. You can choose it when you apply.");

        return ResponseEntity.ok(new ReviewResult("approved"));
    }

    @PatchMapping("/{departmentId}/decline")
    @Transactional
    public ResponseEntity<?> decline(@PathVariable Long departmentId,
                                     @RequestBody DeclineRequest request,
                                     Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department d = departmentRepository.findById(departmentId).orElse(null);
        ResponseEntity<?> problem = check(d, coordinator);
        if (problem != null) return problem;

        String reason = request == null || request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty()) {
            return bad(d.getRequestedByStudentId() == null
                    ? "Please write the reason. It is kept in your records; the company isn't notified."
                    : "Please write the reason for the student.");
        }
        if (reason.length() > 1000) return bad("The reason is too long (max 1000 characters).");

        d.setStatus("declined");
        d.setDeclineReason(reason);
        d.setReviewedAt(LocalDateTime.now());
        departmentRepository.save(d);

        notify(d, "COMPANY_REQUEST_DECLINED", "Your request was declined",
                d.getCompany().getName() + " – " + d.getName() + ": " + reason);

        return ResponseEntity.ok(new ReviewResult("declined"));
    }

    // ---------------------------------------------------------------------
    // Hiling mula sa company link (buong company): edit, approve, merge, reject
    // ---------------------------------------------------------------------

    @PutMapping("/link-requests/{companyId}")
    @Transactional
    public ResponseEntity<?> editLinkRequest(@PathVariable Long companyId, @RequestBody LinkRequestInput body,
                                             Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        Company c = linkService.ownRequest(companyId, coordinator);
        if (c == null) return ResponseEntity.status(404).body("Request not found.");
        if (body == null) return bad("Nothing to save.");
        FieldErrors errors = linkService.validate(body, false);
        if (!errors.isEmpty()) return errors.toResponse();
        try {
            linkService.edit(c, body);
        } catch (ActionException e) {
            return e.toResponse();
        }
        return ResponseEntity.ok(new ReviewResult("pending"));
    }

    @PostMapping("/link-requests/{companyId}/approve")
    @Transactional
    public ResponseEntity<?> approveLinkRequest(@PathVariable Long companyId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        Company c = linkService.ownRequest(companyId, coordinator);
        if (c == null) return ResponseEntity.status(404).body("Request not found.");
        try {
            linkService.approve(c);
        } catch (ActionException e) {
            return e.toResponse();
        }
        return ResponseEntity.ok(new ReviewResult("approved"));
    }

    /** Idagdag ang mga department ng hiling sa company na nasa listahan na, sa halip na gumawa ng pangalawa */
    @PostMapping("/link-requests/{companyId}/merge")
    @Transactional
    public ResponseEntity<?> mergeLinkRequest(@PathVariable Long companyId, @RequestParam Long into,
                                              Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        Company c = linkService.ownRequest(companyId, coordinator);
        if (c == null) return ResponseEntity.status(404).body("Request not found.");
        try {
            linkService.merge(c, into);
        } catch (ActionException e) {
            return e.toResponse();
        }
        return ResponseEntity.ok(new ReviewResult("merged"));
    }

    @PostMapping("/link-requests/{companyId}/reject")
    @Transactional
    public ResponseEntity<?> rejectLinkRequest(@PathVariable Long companyId,
                                               @RequestBody(required = false) RejectRequest body,
                                               Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        Company c = linkService.ownRequest(companyId, coordinator);
        if (c == null) return ResponseEntity.status(404).body("Request not found.");
        try {
            linkService.reject(c, body == null ? null : body.reason());
        } catch (ActionException e) {
            return e.toResponse();
        }
        return ResponseEntity.ok(new ReviewResult("rejected"));
    }

    // ---------------------------------------------------------------------

    /** student | company_link | coordinator */
    private static String sourceOf(Department d) {
        if (d.getRequestSource() != null && !d.getRequestSource().isBlank()) return d.getRequestSource();
        return d.getRequestedByStudentId() != null ? "student" : "coordinator";
    }

    private List<Department> requestedDepartments(List<Company> companies) {
        if (companies.isEmpty()) return new ArrayList<>();
        List<Long> ids = companies.stream().map(Company::getId).toList();
        List<Department> result = new ArrayList<>();
        for (Department d : departmentRepository.findAllByCompanyIds(ids)) {
            if (Boolean.TRUE.equals(d.getIsArchived())) continue;
            if (d.getRequestedByStudentId() != null || !"approved".equalsIgnoreCase(d.getStatus())) result.add(d);
        }
        return result;
    }

    /** Dapat sa coordinator ang department, hiling ng student, at pending pa */
    private ResponseEntity<?> check(Department d, Coordinator coordinator) {
        // Ang bagong hiling mula sa link ay sa buong company sinusuri (link-requests), hindi isa-isang department
        if (d == null || d.getCompany().isHiddenRequest()) return ResponseEntity.notFound().build();
        if (!d.getCompany().getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only review your own students' requests.");
        }
        if (!"pending".equalsIgnoreCase(d.getStatus())) {
            return ResponseEntity.status(409).body("This request was already reviewed.");
        }
        return null;
    }

    private void notify(Department d, String type, String title, String message) {
        if (d.getRequestedByStudentId() == null) return;
        notificationRepository.save(new StudentNotification(d.getRequestedByStudentId(), type, title, message));
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
