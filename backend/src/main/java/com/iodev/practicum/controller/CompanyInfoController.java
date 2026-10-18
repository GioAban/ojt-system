package com.iodev.practicum.controller;

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

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/coordinator/tracking/company-info")
public class CompanyInfoController {

    private static final Pattern PHONE = Pattern.compile("^[0-9+()\\-\\s]{7,20}$");

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private CompanyInfoRepository companyInfoRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentRepository studentRepository;

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
                    c.getId(), c.getName(), d.getId(), d.getName(),
                    c.getAddress(), c.getContactNumber(), c.getLocation(),
                    d.getSupervisorFullname(), d.getSupervisorPosition(), startDate(s)));
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
        if (company == null) return ResponseEntity.notFound().build();
        if (!company.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only edit your own companies.");
        }

        String field = request == null || request.field() == null ? "" : request.field();
        String value = clean(request == null ? null : request.value());

        switch (field) {
            case "name":
                if (value.isEmpty()) return bad("Company name is required.");
                if (value.length() > 255) return bad("Company name is too long (max 255 characters).");
                if (companyRepository.nameExistsExcluding(
                        coordinator.getId(), company.getSemester().getId(), value, id)) {
                    return ResponseEntity.status(409)
                            .body("You already have a company with that name in this semester.");
                }
                company.setName(value);
                break;

            case "address":
                if (value.isEmpty()) return bad("Address is required.");
                if (value.length() > 255) return bad("Address is too long (max 255 characters).");
                company.setAddress(value);
                break;

            case "contactNumber":
                if (value.isEmpty()) return bad("Contact number is required.");
                if (!PHONE.matcher(value).matches()) return bad("Enter a valid contact number.");
                company.setContactNumber(value);
                break;

            case "location":
                if (value.length() > 255) return bad("Location is too long (max 255 characters).");
                company.setLocation(value.isEmpty() ? null : value);
                break;

            default:
                return bad("That field can't be edited here.");
        }

        companyRepository.save(company);

        long affected = countStudents(departmentRepository.findAllByCompanyIds(List.of(id)));
        return ResponseEntity.ok(new CompanyInfoEditResult(value, affected));
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
        if (department == null) return ResponseEntity.notFound().build();
        if (!department.getCompany().getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only edit your own departments.");
        }

        String field = request == null || request.field() == null ? "" : request.field();
        String value = clean(request == null ? null : request.value());

        switch (field) {
            case "name":
                if (value.isEmpty()) return bad("Department name is required.");
                if (value.length() > 255) return bad("Department name is too long (max 255 characters).");
                if (departmentRepository.nameExistsInCompanyExcluding(
                        department.getCompany().getId(), value, id)) {
                    return ResponseEntity.status(409)
                            .body("This company already has a department with that name.");
                }
                department.setName(value);
                break;

            case "supervisorName":
                if (value.isEmpty()) return bad("The supervisor's name is required.");
                if (value.length() > 255) return bad("The supervisor's name is too long (max 255 characters).");
                department.setSupervisorFullname(value);
                break;

            case "supervisorPosition":
                if (value.length() > 255) return bad("The position is too long (max 255 characters).");
                // Blangkong teksto ang walang laman, para hindi mabangga ang NOT NULL
                department.setSupervisorPosition(value);
                break;

            default:
                return bad("That field can't be edited here.");
        }

        departmentRepository.save(department);

        long affected = countStudents(List.of(department));
        return ResponseEntity.ok(new CompanyInfoEditResult(value, affected));
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

        String raw = request == null || request.value() == null ? "" : request.value().trim();
        String stored = null;

        if (!raw.isEmpty()) {
            try {
                LocalDate date = LocalDate.parse(raw);
                if (date.getYear() < 2000 || date.getYear() > 2100) {
                    return bad("Please enter a year between 2000 and 2100.");
                }
                stored = date.toString();
            } catch (DateTimeParseException e) {
                return bad("Date must look like 2026-02-10.");
            }
        }

        student.setStartTrainingDate(stored);
        studentRepository.save(student);

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

    private String startDate(Student s) {
        String raw = s.getStartTrainingDate() != null && !s.getStartTrainingDate().isBlank()
                ? s.getStartTrainingDate()
                : s.getDeployedDate();
        return raw == null || raw.length() < 10 ? null : raw.substring(0, 10);
    }

    private long countStudents(Collection<Department> departments) {
        if (departments.isEmpty()) return 0;

        long total = 0;
        List<Long> ids = departments.stream().map(Department::getId).toList();
        for (Object[] row : studentRepository.countByDepartmentIds(ids)) {
            total += (Long) row[1];
        }
        return total;
    }
}