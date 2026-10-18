package com.iodev.practicum.controller;

import com.iodev.practicum.dto.AssignmentResultResponse;
import com.iodev.practicum.dto.CompanyOptionResponse;
import com.iodev.practicum.dto.DepartmentAssignRequest;
import com.iodev.practicum.dto.MoaRequest;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentDepartmentHistory;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentDepartmentHistoryRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import com.iodev.practicum.util.EmploymentValues;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.iodev.practicum.dto.CompleteOjtRequest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/coordinator/students")
public class CoordinatorStudentController {

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private StudentDepartmentHistoryRepository historyRepository;

    @GetMapping("/{studentId}/company-options")
    @Transactional(readOnly = true)
    public ResponseEntity<?> companyOptions(@PathVariable Long studentId, Authentication authentication) {
        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }

        List<Company> companies =
                companyRepository.findForAssignment(coordinator.getId(), student.getSemester().getId());
        if (companies.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<Long> companyIds = companies.stream().map(Company::getId).toList();
        List<Department> departments = departmentRepository.findActiveByCompanyIds(companyIds);

        Map<Long, Long> filled = new HashMap<>();
        if (!departments.isEmpty()) {
            List<Long> departmentIds = departments.stream().map(Department::getId).toList();
            for (Object[] row : studentRepository.countByDepartmentIds(departmentIds)) {
                filled.put((Long) row[0], (Long) row[1]);
            }
        }

        Long currentDepartmentId = student.getDepartment() == null ? null : student.getDepartment().getId();

        Map<Long, List<CompanyOptionResponse.DepartmentOption>> byCompany = new HashMap<>();
        for (Department d : departments) {
            int slots = d.getSlots() == null ? 0 : d.getSlots();
            boolean current = currentDepartmentId != null && currentDepartmentId.equals(d.getId());

            byCompany.computeIfAbsent(d.getCompany().getId(), k -> new ArrayList<>()).add(
                    new CompanyOptionResponse.DepartmentOption(
                            d.getId(), d.getName(), slots, filled.getOrDefault(d.getId(), 0L), current,
                            d.getSupervisorFullname(), d.getSupervisorPosition(),
                            d.getSupervisorContactNumber(), d.getSupervisorEmail(),
                            d.getStatus(), d.getMoaStart(), d.getMoaExpiration()));
        }

        List<CompanyOptionResponse> result = companies.stream()
                .map(c -> new CompanyOptionResponse(
                        c.getId(), c.getName(), c.getAddress(), c.getLocation(), c.getContactNumber(),
                        c.getNature() == null ? null : c.getNature().getName(),
                        c.getDescription(), c.getImsupFullname(), c.getImsupPosition(),
                        byCompany.getOrDefault(c.getId(), List.of())))
                .toList();

        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{studentId}/department")
    @Transactional
    public ResponseEntity<?> assignDepartment(@PathVariable Long studentId,
                                              @RequestBody DepartmentAssignRequest request,
                                              Authentication authentication) {
        if (request == null || request.getDepartmentId() == null) {
            return ResponseEntity.badRequest().body("Please select a department.");
        }

        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }

        Department department = departmentRepository.findById(request.getDepartmentId()).orElse(null);
        if (department == null) {
            return ResponseEntity.badRequest().body("Selected department was not found.");
        }

        Company company = department.getCompany();
        if (!company.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("That company doesn't belong to you.");
        }
        if (!company.getSemester().getId().equals(student.getSemester().getId())) {
            return ResponseEntity.badRequest().body("That company belongs to a different semester.");
        }
        if (Boolean.TRUE.equals(company.getIsArchived()) || Boolean.TRUE.equals(department.getIsArchived())) {
            return ResponseEntity.badRequest().body("That company or department is archived.");
        }
        if (!"approved".equalsIgnoreCase(department.getStatus())) {
            return ResponseEntity.badRequest().body("That department isn't approved yet.");
        }

        AssignmentResultResponse result =
                new AssignmentResultResponse(department.getId(), department.getName(), company.getName());

        Department currentDepartment = student.getDepartment();
        if (currentDepartment != null && currentDepartment.getId().equals(department.getId())) {
            return ResponseEntity.ok(result); // walang babaguhin
        }

        long filled = 0;
        for (Object[] row : studentRepository.countByDepartmentIds(List.of(department.getId()))) {
            filled = (Long) row[1];
        }
        int slots = department.getSlots() == null ? 0 : department.getSlots();
        if (filled >= slots) {
            return ResponseEntity.status(409).body("This department has no slots left.");
        }

        Timestamp now = new Timestamp(System.currentTimeMillis());
        boolean hadPrevious = currentDepartment != null || historyRepository.countByStudentId(studentId) > 0;

        List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(studentId);
        for (StudentDepartmentHistory h : open) {
            h.setEndedAt(now);
        }
        historyRepository.saveAll(open);

        StudentDepartmentHistory history = new StudentDepartmentHistory();
        history.setStudent(student);
        history.setDepartment(department);
        history.setType(hadPrevious ? "transferred" : "initial");
        history.setStartedAt(now);
        historyRepository.save(history);

        student.setDepartment(department);
        studentRepository.save(student);

        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{studentId}/department")
    @Transactional
    public ResponseEntity<?> removeDepartment(@PathVariable Long studentId, Authentication authentication) {
        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }

        // Kung wala namang naka-assign, ituring na tapos na (para mag-sync ang UI)
        if (student.getDepartment() == null) {
            return ResponseEntity.ok(new AssignmentResultResponse(null, null, null));
        }

        Timestamp now = new Timestamp(System.currentTimeMillis());

        List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(studentId);
        for (StudentDepartmentHistory h : open) {
            h.setEndedAt(now);
        }
        historyRepository.saveAll(open);

        student.setDepartment(null);
        studentRepository.save(student);

        return ResponseEntity.ok(new AssignmentResultResponse(null, null, null));
    }

    @PatchMapping("/{studentId}/moa")
    @Transactional
    public ResponseEntity<?> updateMoa(@PathVariable Long studentId,
                                       @RequestBody MoaRequest request,
                                       Authentication authentication) {
        String key = request == null || request.getStatus() == null
                ? "" : request.getStatus().trim().toUpperCase();

        String stored;
        if (key.equals("RELEASED")) {
            stored = "Released";
        } else if (key.equals("NOT_RELEASED")) {
            stored = "Not Released";
        } else {
            return ResponseEntity.badRequest().body("Status must be RELEASED or NOT_RELEASED.");
        }

        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }

        student.setMoaStatus(stored);
        studentRepository.save(student);

        return ResponseEntity.ok(Map.of("moaStatus", stored));
    }

    @PatchMapping("/{studentId}/complete")
    @Transactional
    public ResponseEntity<?> completeOjt(@PathVariable Long studentId,
                                        @RequestBody CompleteOjtRequest request,
                                        Authentication authentication) {
        String raw = request == null || request.completedDate() == null ? "" : request.completedDate().trim();
        if (raw.isEmpty()) {
            return ResponseEntity.badRequest().body("Please enter the completion date.");
        }

        LocalDate completed;
        try {
            completed = LocalDate.parse(raw);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body("Date must look like 2026-04-30.");
        }

        if (completed.isAfter(LocalDate.now())) {
            return ResponseEntity.badRequest().body("The completion date can't be in the future.");
        }
        if (completed.getYear() < 2000) {
            return ResponseEntity.badRequest().body("Please enter a valid completion date.");
        }

        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }

        if (student.getDepartment() == null) {
            return ResponseEntity.badRequest()
                    .body("Assign the student to a company before completing the OJT.");
        }

        String startRaw = student.getStartTrainingDate() != null && !student.getStartTrainingDate().isBlank()
                ? student.getStartTrainingDate()
                : student.getDeployedDate();
        if (startRaw != null && startRaw.length() >= 10) {
            try {
                LocalDate start = LocalDate.parse(startRaw.substring(0, 10));
                if (completed.isBefore(start)) {
                    return ResponseEntity.badRequest()
                            .body("The completion date can't be earlier than the start date (" + start + ").");
                }
            } catch (DateTimeParseException ignored) {
                // hindi mabasa ang start date, laktawan ang pagsusuri
            }
        }

        student.setStatus("Completed");
        student.setCompletedDate(completed.toString());
        studentRepository.save(student);

        Timestamp end = Timestamp.valueOf(completed.atStartOfDay());
        List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(studentId);
        for (StudentDepartmentHistory h : open) {
            h.setEndedAt(h.getStartedAt() != null && end.before(h.getStartedAt()) ? h.getStartedAt() : end);
        }
        historyRepository.saveAll(open);

        return ResponseEntity.ok(Map.of("status", "Completed", "completedDate", completed.toString()));
    }

    @PatchMapping("/{studentId}/employment")
    @Transactional
    public ResponseEntity<?> updateEmployment(@PathVariable Long studentId,
                                            @RequestBody Map<String, String> body,
                                            Authentication authentication) {
        if (body == null || body.isEmpty()) {
            return ResponseEntity.badRequest().body("Nothing to update.");
        }

        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }
        if (!"Completed".equalsIgnoreCase(student.getStatus())) {
            return ResponseEntity.badRequest().body("Complete the student's OJT first.");
        }

        if (body.containsKey("hiredDate")) {
            String raw = body.get("hiredDate") == null ? "" : body.get("hiredDate").trim();

            if (raw.isEmpty()) {
                student.setHiredDate(null);
            } else {
                LocalDate hired;
                try {
                    hired = LocalDate.parse(raw);
                } catch (DateTimeParseException e) {
                    return ResponseEntity.badRequest().body("Date must look like 2026-05-04.");
                }

                if (hired.isAfter(LocalDate.now())) {
                    return ResponseEntity.badRequest().body("The hired date can't be in the future.");
                }
                if (hired.getYear() < 2000) {
                    return ResponseEntity.badRequest().body("Please enter a valid hired date.");
                }

                String completedRaw = student.getCompletedDate();
                if (completedRaw != null && completedRaw.length() >= 10) {
                    try {
                        LocalDate completed = LocalDate.parse(completedRaw.substring(0, 10));
                        if (hired.isBefore(completed)) {
                            return ResponseEntity.badRequest().body(
                                    "The hired date can't be earlier than the completion date (" + completed + ").");
                        }
                    } catch (DateTimeParseException ignored) {
                        // hindi mabasa ang completed date, laktawan ang pagsusuri
                    }
                }

                student.setHiredDate(hired);
            }
        }

        if (body.containsKey("jobRelated")) {
            String raw = body.get("jobRelated");
            boolean clear = raw == null || raw.isBlank();
            String stored = clear ? null : EmploymentValues.jobStored(raw);

            if (!clear && stored == null) {
                return ResponseEntity.badRequest()
                        .body("Job relation must be RELATED, SOMEWHAT_RELATED, or UNRELATED.");
            }
            student.setJobRelatedToCourse(stored);
        }

        if (body.containsKey("employabilityLevel")) {
            String raw = body.get("employabilityLevel");
            boolean clear = raw == null || raw.isBlank();
            String stored = clear ? null : EmploymentValues.levelStored(raw);

            if (!clear && stored == null) {
                return ResponseEntity.badRequest()
                        .body("Employability must be HIGH, AVERAGE, or LOW.");
            }
            student.setEmployabilityLevel(stored);
        }

        studentRepository.save(student);

        Map<String, Object> result = new HashMap<>();
        result.put("hiredDate", student.getHiredDate() == null ? null : student.getHiredDate().toString());
        result.put("jobRelated", EmploymentValues.jobKey(student.getJobRelatedToCourse()));
        result.put("employabilityLevel", EmploymentValues.levelKey(student.getEmployabilityLevel()));
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{studentId}/complete")
    @Transactional
    public ResponseEntity<?> revertCompletion(@PathVariable Long studentId, Authentication authentication) {
        Coordinator coordinator = currentCoordinator(authentication);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!owns(coordinator, student)) {
            return ResponseEntity.status(403).body("You can only manage your own students.");
        }
        if (!"Completed".equalsIgnoreCase(student.getStatus())) {
            return ResponseEntity.badRequest().body("This student isn't marked as completed.");
        }

        student.setStatus("Deployed");
        student.setCompletedDate(null);
        student.setHiredDate(null);
        student.setJobRelatedToCourse(null);
        student.setEmployabilityLevel(null);
        studentRepository.save(student);

        // Buksan ulit ang placement na isinara ng pag-complete
        Department department = student.getDepartment();
        if (department != null && historyRepository.findByStudentIdAndEndedAtIsNull(studentId).isEmpty()) {
            historyRepository
                    .findFirstByStudentIdAndDepartmentIdOrderByIdDesc(studentId, department.getId())
                    .ifPresent(h -> {
                        h.setEndedAt(null);
                        historyRepository.save(h);
                    });
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "Deployed");
        result.put("completedDate", null);
        return ResponseEntity.ok(result);
    }

    private Coordinator currentCoordinator(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private boolean owns(Coordinator coordinator, Student student) {
        return student.getCoordinator().getId().equals(coordinator.getId());
    }

}