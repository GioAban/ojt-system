package com.iodev.practicum.controller;

import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.CompanyInfoService;
import com.iodev.practicum.service.PreparedChange;
import com.iodev.practicum.service.SupervisorResolver;
import com.iodev.practicum.dto.CompanyInfoDtos.CompanyInfoEdit;
import com.iodev.practicum.dto.CompanyInfoDtos.CompanyInfoEditResult;
import com.iodev.practicum.dto.CompanyInfoDtos.CompanyInfoResponse;
import com.iodev.practicum.dto.CompanyInfoDtos.CompanyInfoRow;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyInfoRepository;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/coordinator/tracking/company-info")
public class CompanyInfoController {


    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CompanyInfoRepository companyInfoRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private CompanyInfoService companyInfoService;

    // ---------------------------------------------------------------------
    // Listahan
    // ---------------------------------------------------------------------

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<CompanyInfoRow> rows = new ArrayList<>();
        for (Student s : companyInfoRepository.findPlaced(coordinator.getId(), semesterId)) {
            Department d = s.getDepartment();
            Company c = d.getCompany();

            rows.add(new CompanyInfoRow(
                    s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                    s.getMiddleInitial(), s.getSubjectCode(),
                    c.getId(), c.getName(), d.getId(), SupervisorResolver.departmentLabel(d.getName()),
                    c.getAddress(), c.getContactNumber(), c.getLocation(),
                    SupervisorResolver.forDepartment(d).nameOrNull(),
                    SupervisorResolver.forDepartment(d).positionOrNull(), startDate(s),
                    editTarget(d)));
        }

        return ResponseEntity.ok(new CompanyInfoResponse(semesterId, rows));
    }

    // ---------------------------------------------------------------------
    // Company: name, address, contactNumber, location
    // ---------------------------------------------------------------------

    @PatchMapping("/company/{id}")
    @Transactional
    public ResponseEntity<?> editCompany(@PathVariable Long id,
                                         @RequestBody CompanyInfoEdit request,
                                         Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Company company = companyRepository.findById(id).orElse(null);
        if (company == null || company.isHiddenRequest()) return ResponseEntity.notFound().build();
        if (!company.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only edit your own companies.");
        }

        // Nasa CompanyInfoService ang pagsusuri (iisa para sa Company Info at sa mga report)
        String field = request == null || request.field() == null ? "" : request.field();
        String value = clean(request == null ? null : request.value());
        try {
            PreparedChange change = companyInfoService.checkCompany(company, field, value);
            change.run();
            return ResponseEntity.ok(new CompanyInfoEditResult(value, change.affected()));
        } catch (ActionException e) {
            return e.toResponse();
        }
    }

    // ---------------------------------------------------------------------
    // Department: name, supervisorName, supervisorPosition
    // ---------------------------------------------------------------------

    @PatchMapping("/department/{id}")
    @Transactional
    public ResponseEntity<?> editDepartment(@PathVariable Long id,
                                            @RequestBody CompanyInfoEdit request,
                                            Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department department = departmentRepository.findById(id).orElse(null);
        if (department == null || department.getCompany().isHiddenRequest()) return ResponseEntity.notFound().build();
        if (!department.getCompany().getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only edit your own departments.");
        }

        String field = request == null || request.field() == null ? "" : request.field();
        String value = clean(request == null ? null : request.value());
        try {
            PreparedChange change = companyInfoService.checkDepartment(department, field, value, null);
            change.run();
            return ResponseEntity.ok(new CompanyInfoEditResult(change.newValue(), change.affected()));
        } catch (ActionException e) {
            return e.toResponse();
        }
    }

    /**
     * Immediate supervisor ng company (pangalan o posisyon). Ginagamit kapag ang ipinapakitang supervisor ay galing
     * sa company (walang sariling supervisor ang department, o N/A), para hindi ito maisulat sa department.
     */
    @PatchMapping("/company/{id}/supervisor")
    @Transactional
    public ResponseEntity<?> editCompanySupervisor(@PathVariable Long id,
                                                   @RequestBody CompanyInfoEdit request,
                                                   Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Company company = companyRepository.findById(id).orElse(null);
        if (company == null || company.isHiddenRequest()) return ResponseEntity.notFound().build();
        if (!company.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only edit your own companies.");
        }

        String field = request == null || request.field() == null ? "" : request.field();
        String value = clean(request == null ? null : request.value());
        try {
            PreparedChange change = companyInfoService.checkCompanySupervisor(company, field, value, null);
            change.run();
            return ResponseEntity.ok(new CompanyInfoEditResult(change.newValue(), change.affected()));
        } catch (ActionException e) {
            return e.toResponse();
        }
    }

    // ---------------------------------------------------------------------
    // Student: date started
    // ---------------------------------------------------------------------

    @PatchMapping("/student/{id}/start-date")
    @Transactional
    public ResponseEntity<?> editStartDate(@PathVariable Long id,
                                           @RequestBody CompanyInfoEdit request,
                                           Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student student = studentRepository.findById(id).orElse(null);
        if (student == null) return ResponseEntity.notFound().build();
        if (!student.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only edit your own students.");
        }

        try {
            companyInfoService.checkStartDate(student, request == null ? null : request.value()).run();
        } catch (ActionException e) {
            return e.toResponse();
        }

        // Kapag na-clear, ang deployed date ang ipapakita
        return ResponseEntity.ok(new CompanyInfoEditResult(startDate(student), 1));
    }

    // ---------------------------------------------------------------------
    // Mga helper
    // ---------------------------------------------------------------------

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    /** Kung saan galing ang ipinapakitang supervisor; ang N/A na walang laman ay sa company din */
    private static String editTarget(Department d) {
        String source = SupervisorResolver.sourceOf(d);
        if (source.equals("company")) return "company";
        if (source.equals("none") && SupervisorResolver.isPlaceholderDepartment(d.getName())) return "company";
        return "department";
    }

    private String startDate(Student s) {
        String raw = s.getStartTrainingDate() != null && !s.getStartTrainingDate().isBlank()
                ? s.getStartTrainingDate()
                : s.getDeployedDate();
        return raw == null || raw.length() < 10 ? null : raw.substring(0, 10);
    }
}