package com.iodev.practicum.controller;

import com.iodev.practicum.model.CompanyApplication;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.repository.CompanyApplicationRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentNotificationRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Ang coordinator ang tumatanggap (nagde-deploy) o nagde-decline ng aplikasyon ng student sa company. */
@RestController
@RequestMapping("/api/coordinator/company-applications")
public class CoordinatorApplicationsController {

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CompanyApplicationRepository applicationRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentNotificationRepository notificationRepository;

    public record Row(Long id, String status, String createdAt, String reviewedAt, String declineReason,
                      Long studentId, String studentNumber, String firstname, String lastname,
                      String middleInitial, String subjectCode, String studentStatus,
                      Long companyId, String companyName, String departmentName,
                      int slots, int filled) {}

    public record ListResult(long pendingCount, List<Row> applications) {}

    public record PendingCount(long count) {}

    public record DeclineBody(String reason) {}

    public record Result(String status) {}

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<CompanyApplication> apps = applicationRepository.findForCoordinator(coordinator.getId(), semesterId);
        Map<Long, Student> students = new HashMap<>();
        for (Student s : studentRepository.findAllById(apps.stream().map(CompanyApplication::getStudentId).distinct().toList())) {
            students.put(s.getId(), s);
        }
        List<Long> deptIds = apps.stream().map(CompanyApplication::getDepartmentId).distinct().toList();
        Map<Long, Department> depts = new HashMap<>();
        for (Department d : departmentRepository.findAllById(deptIds)) depts.put(d.getId(), d);
        Map<Long, Integer> filled = new HashMap<>();
        if (!deptIds.isEmpty()) {
            for (Object[] r : studentRepository.countByDepartmentIds(deptIds)) {
                filled.put((Long) r[0], ((Long) r[1]).intValue());
            }
        }

        List<Row> rows = new ArrayList<>();
        long pending = 0;
        for (CompanyApplication a : apps) {
            Student s = students.get(a.getStudentId());
            Department d = depts.get(a.getDepartmentId());
            if (s == null || d == null) continue;
            if (CompanyApplication.PENDING.equals(a.getStatus())) pending++;
            rows.add(new Row(a.getId(), a.getStatus().toLowerCase(), a.getCreatedAt().toString(),
                    a.getReviewedAt() == null ? null : a.getReviewedAt().toString(), a.getDeclineReason(),
                    s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(), s.getMiddleInitial(),
                    s.getSubjectCode(), s.getStatus(),
                    d.getCompany().getId(), d.getCompany().getName(),
                    d.getName() == null || d.getName().isBlank() ? "N/A" : d.getName(),
                    d.getSlots() == null ? 0 : d.getSlots(), filled.getOrDefault(d.getId(), 0)));
        }
        return ResponseEntity.ok(new ListResult(pending, rows));
    }

    @GetMapping("/pending-count")
    @Transactional(readOnly = true)
    public ResponseEntity<?> pendingCount(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        return ResponseEntity.ok(new PendingCount(applicationRepository.countPending(coordinator.getId(), semesterId)));
    }

    @PatchMapping("/{id}/accept")
    @Transactional
    public ResponseEntity<?> accept(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        CompanyApplication a = applicationRepository.findById(id).orElse(null);
        Student s = a == null ? null : studentRepository.findById(a.getStudentId()).orElse(null);
        ResponseEntity<?> problem = check(a, s, coordinator);
        if (problem != null) return problem;

        Department d = departmentRepository.findById(a.getDepartmentId()).orElse(null);
        if (d == null || Boolean.TRUE.equals(d.getIsArchived()) || !"approved".equalsIgnoreCase(d.getStatus())) {
            return ResponseEntity.status(409).body("That department is no longer available. Decline this application.");
        }
        String st = s.getStatus() == null ? "" : s.getStatus().trim();
        if (!"approved".equalsIgnoreCase(st)) {
            return ResponseEntity.status(409).body("Only Approved students can be placed from here. Current status: "
                    + (st.isEmpty() ? "For Approval" : st) + ".");
        }
        int filled = 0;
        for (Object[] r : studentRepository.countByDepartmentIds(List.of(d.getId()))) filled = ((Long) r[1]).intValue();
        if (d.getSlots() != null && filled >= d.getSlots()) {
            return ResponseEntity.status(409).body("No open slots in " + d.getCompany().getName()
                    + ". Add slots in Host Training Establishments first.");
        }

        s.setDepartment(d);
        s.setStatus("Deployed");
        s.setDeployedDate(LocalDate.now().toString());
        studentRepository.save(s);

        a.setStatus(CompanyApplication.ACCEPTED);
        a.setReviewedAt(LocalDateTime.now());
        a.setDeclineReason(null);
        applicationRepository.save(a);

        for (CompanyApplication other : applicationRepository.findByStudentIdAndStatus(s.getId(), CompanyApplication.PENDING)) {
            other.setStatus(CompanyApplication.CANCELLED);
            other.setReviewedAt(LocalDateTime.now());
            applicationRepository.save(other);
        }

        notificationRepository.save(new StudentNotification(s.getId(), "company_application_accepted",
                "You're deployed!",
                d.getCompany().getName() + " – " + (d.getName() == null ? "N/A" : d.getName())
                        + " accepted your application. Weekly Report, DTR and Post-Deployment are now open."));

        return ResponseEntity.ok(new Result("accepted"));
    }

    @PatchMapping("/{id}/decline")
    @Transactional
    public ResponseEntity<?> decline(@PathVariable Long id, @RequestBody DeclineBody body, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        CompanyApplication a = applicationRepository.findById(id).orElse(null);
        Student s = a == null ? null : studentRepository.findById(a.getStudentId()).orElse(null);
        ResponseEntity<?> problem = check(a, s, coordinator);
        if (problem != null) return problem;

        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty()) return ResponseEntity.badRequest().body("Please write the reason for the student.");
        if (reason.length() > 1000) return ResponseEntity.badRequest().body("The reason is too long (max 1000 characters).");

        a.setStatus(CompanyApplication.DECLINED);
        a.setDeclineReason(reason);
        a.setReviewedAt(LocalDateTime.now());
        applicationRepository.save(a);

        Department d = departmentRepository.findById(a.getDepartmentId()).orElse(null);
        String where = d == null ? "the company"
                : d.getCompany().getName() + " – " + (d.getName() == null ? "N/A" : d.getName());
        notificationRepository.save(new StudentNotification(s.getId(), "company_application_declined",
                "Your application was declined", where + ": " + reason));

        return ResponseEntity.ok(new Result("declined"));
    }

    private ResponseEntity<?> check(CompanyApplication a, Student s, Coordinator coordinator) {
        if (a == null || s == null) return ResponseEntity.notFound().build();
        if (s.getCoordinator() == null || !s.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only review your own students' applications.");
        }
        if (!CompanyApplication.PENDING.equals(a.getStatus())) {
            return ResponseEntity.status(409).body("This application was already reviewed.");
        }
        return null;
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }
}
