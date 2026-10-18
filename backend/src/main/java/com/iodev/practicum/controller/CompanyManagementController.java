package com.iodev.practicum.controller;

import com.iodev.practicum.dto.CompanyManagementDtos.*;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanyNature;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CompanyNatureRepository;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import com.iodev.practicum.model.DepartmentMoaFile;
import com.iodev.practicum.repository.DepartmentMoaFileRepository;


@RestController
@RequestMapping("/api/coordinator/companies")
public class CompanyManagementController {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^[0-9+()\\-\\s]{7,20}$");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private CompanyNatureRepository natureRepository;

    @Autowired
    private SemesterRepository semesterRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private DepartmentMoaFileRepository moaFileRepository;

    // =====================================================================
    // Listahan
    // =====================================================================

        @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<Company> companies = companyRepository.findAllForManagement(coordinator.getId(), semesterId);
        List<Department> departments = companies.isEmpty()
                ? List.of()
                : departmentRepository.findAllByCompanyIds(companies.stream().map(Company::getId).toList());

        Map<Long, Long> filled = filledCounts(departments);
        Map<Long, List<Department>> byCompany =
                departments.stream().collect(Collectors.groupingBy(d -> d.getCompany().getId()));

        Map<Long, List<MoaFileItem>> moaFiles = new HashMap<>();
        if (!departments.isEmpty()) {
            for (DepartmentMoaFile f : moaFileRepository.findByDepartmentIds(
                    departments.stream().map(Department::getId).toList())) {
                moaFiles.computeIfAbsent(f.getDepartment().getId(), k -> new ArrayList<>())
                        .add(MoaFileItem.from(f));
            }
        }

        List<CompanyItem> items = new ArrayList<>();
        for (Company c : companies) {
            List<DepartmentItem> deptItems = byCompany.getOrDefault(c.getId(), List.of()).stream()
                    .map(d -> toItem(
                            d,
                            filled.getOrDefault(d.getId(), 0L),
                            moaFiles.getOrDefault(d.getId(), List.of())))
                    .toList();

            long placed = deptItems.stream().mapToLong(DepartmentItem::filled).sum();
            int slots = deptItems.stream().filter(d -> !d.archived()).mapToInt(DepartmentItem::slots).sum();

            CompanyNature nature = c.getNature();
            items.add(new CompanyItem(
                    c.getId(), c.getName(), c.getAddress(), c.getLocation(), c.getContactNumber(),
                    nature == null ? null : nature.getId(), nature == null ? null : nature.getName(),
                    c.getDescription(), c.getImsupFullname(), c.getImsupPosition(),
                    c.getImsupCompEvidIdentity(), c.getImsupCompEvidIdentityNo(),
                    Boolean.TRUE.equals(c.getIsArchived()), placed, slots, deptItems));
        }

        List<NatureItem> natures = natureRepository.findAll(Sort.by("name")).stream()
                .map(n -> new NatureItem(n.getId(), n.getName()))
                .toList();

        return ResponseEntity.ok(new CompaniesResponse(semesterId, items, natures));
    }

    // =====================================================================
    // Company
    // =====================================================================

    @PostMapping
    @Transactional
    public ResponseEntity<?> createCompany(@RequestBody CompanyRequest request, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        String error = validateCompany(request);
        if (error != null) return bad(error);

        if (request.semesterId() == null) return bad("Please select a semester.");
        Semester semester = semesterRepository.findById(request.semesterId()).orElse(null);
        if (semester == null) return bad("Selected semester was not found.");
        if (Boolean.TRUE.equals(semester.getIsArchived())) return bad("That semester is archived.");

        CompanyNature nature = natureRepository.findById(request.natureId()).orElse(null);
        if (nature == null) return bad("Selected nature was not found.");

        String name = clean(request.name());
        if (companyRepository.nameExists(coordinator.getId(), semester.getId(), name)) {
            return conflict("You already have a company with that name in this semester.");
        }

        Company company = new Company();
        company.setCoordinator(coordinator);
        company.setSemester(semester);
        company.setIsArchived(false);
        applyCompany(company, request, nature);

        return ResponseEntity.ok(Map.of("id", companyRepository.save(company).getId()));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateCompany(@PathVariable Long id,
                                           @RequestBody CompanyRequest request,
                                           Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Company company = companyRepository.findById(id).orElse(null);
        if (company == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, company)) return notOwner();

        String error = validateCompany(request);
        if (error != null) return bad(error);

        CompanyNature nature = natureRepository.findById(request.natureId()).orElse(null);
        if (nature == null) return bad("Selected nature was not found.");

        String name = clean(request.name());
        if (companyRepository.nameExistsExcluding(
                coordinator.getId(), company.getSemester().getId(), name, id)) {
            return conflict("You already have a company with that name in this semester.");
        }

        applyCompany(company, request, nature);
        return ResponseEntity.ok(Map.of("id", companyRepository.save(company).getId()));
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archiveCompany(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Company company = companyRepository.findById(id).orElse(null);
        if (company == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, company)) return notOwner();

        long placed = filledCounts(departmentRepository.findAllByCompanyIds(List.of(id)))
                .values().stream().mapToLong(Long::longValue).sum();
        if (placed > 0) {
            return bad("This company still has " + placed
                    + " student(s) placed. Remove them from the company first.");
        }

        company.setIsArchived(true);
        companyRepository.save(company);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/restore")
    @Transactional
    public ResponseEntity<?> restoreCompany(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Company company = companyRepository.findById(id).orElse(null);
        if (company == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, company)) return notOwner();

        if (companyRepository.nameExistsExcluding(
                coordinator.getId(), company.getSemester().getId(), company.getName(), id)) {
            return conflict("An active company with that name already exists. Rename one of them first.");
        }

        company.setIsArchived(false);
        companyRepository.save(company);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Department
    // =====================================================================

    @PostMapping("/{companyId}/departments")
    @Transactional
    public ResponseEntity<?> createDepartment(@PathVariable Long companyId,
                                              @RequestBody DepartmentRequest request,
                                              Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Company company = companyRepository.findById(companyId).orElse(null);
        if (company == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, company)) return notOwner();
        if (Boolean.TRUE.equals(company.getIsArchived())) return bad("Restore the company first.");

        String error = validateDepartment(request);
        if (error != null) return bad(error);

        String name = clean(request.name());
        if (departmentRepository.nameExistsInCompany(companyId, name)) {
            return conflict("This company already has a department with that name.");
        }

        Department department = new Department();
        department.setCompany(company);
        department.setIsArchived(false);
        applyDepartment(department, request);

        return ResponseEntity.ok(Map.of("id", departmentRepository.save(department).getId()));
    }

    @PutMapping("/departments/{id}")
    @Transactional
    public ResponseEntity<?> updateDepartment(@PathVariable Long id,
                                              @RequestBody DepartmentRequest request,
                                              Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department department = departmentRepository.findById(id).orElse(null);
        if (department == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, department.getCompany())) return notOwner();

        String error = validateDepartment(request);
        if (error != null) return bad(error);

        long filled = filledCounts(List.of(department)).getOrDefault(id, 0L);
        if (request.slots() < filled) {
            return bad("This department already has " + filled
                    + " student(s) placed. Slots can't be lower than that.");
        }

        String name = clean(request.name());
        if (departmentRepository.nameExistsInCompanyExcluding(department.getCompany().getId(), name, id)) {
            return conflict("This company already has a department with that name.");
        }

        applyDepartment(department, request);
        return ResponseEntity.ok(Map.of("id", departmentRepository.save(department).getId()));
    }

    @PatchMapping("/departments/{id}/approval")
    @Transactional
    public ResponseEntity<?> approval(@PathVariable Long id,
                                      @RequestBody ApprovalRequest request,
                                      Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department department = departmentRepository.findById(id).orElse(null);
        if (department == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, department.getCompany())) return notOwner();

        String status = request == null || request.status() == null ? "" : request.status().trim();
        if (!status.equalsIgnoreCase("APPROVED") && !status.equalsIgnoreCase("PENDING")) {
            return bad("Status must be APPROVED or PENDING.");
        }

        department.setStatus(status.toLowerCase());
        departmentRepository.save(department);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/departments/{id}/archive")
    @Transactional
    public ResponseEntity<?> archiveDepartment(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department department = departmentRepository.findById(id).orElse(null);
        if (department == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, department.getCompany())) return notOwner();

        long filled = filledCounts(List.of(department)).getOrDefault(id, 0L);
        if (filled > 0) {
            return bad("This department still has " + filled
                    + " student(s) placed. Remove them from the department first.");
        }

        department.setIsArchived(true);
        departmentRepository.save(department);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/departments/{id}/restore")
    @Transactional
    public ResponseEntity<?> restoreDepartment(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Department department = departmentRepository.findById(id).orElse(null);
        if (department == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, department.getCompany())) return notOwner();

        if (Boolean.TRUE.equals(department.getCompany().getIsArchived())) {
            return bad("Restore the company first.");
        }
        if (departmentRepository.nameExistsInCompanyExcluding(
                department.getCompany().getId(), department.getName(), id)) {
            return conflict("An active department with that name already exists. Rename one of them first.");
        }

        department.setIsArchived(false);
        departmentRepository.save(department);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Mga helper
    // =====================================================================

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private boolean owns(Coordinator coordinator, Company company) {
        return company.getCoordinator().getId().equals(coordinator.getId());
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> notOwner() {
        return ResponseEntity.status(403).body("You can only manage your own companies.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }

    private ResponseEntity<?> conflict(String message) {
        return ResponseEntity.status(409).body(message);
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String emptyToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    private Map<Long, Long> filledCounts(Collection<Department> departments) {
        Map<Long, Long> result = new HashMap<>();
        if (departments.isEmpty()) return result;

        List<Long> ids = departments.stream().map(Department::getId).toList();
        for (Object[] row : studentRepository.countByDepartmentIds(ids)) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }

    private DepartmentItem toItem(Department d, long filled, List<MoaFileItem> files) {
        String status = d.getStatus() == null || d.getStatus().isBlank()
                ? "PENDING"
                : d.getStatus().trim().toUpperCase();

        return new DepartmentItem(
                d.getId(), d.getName(), d.getSlots() == null ? 0 : d.getSlots(), filled,
                d.getSupervisorFullname(), d.getSupervisorPosition(),
                d.getSupervisorContactNumber(), d.getSupervisorEmail(),
                status, d.getMoaStart(), d.getMoaExpiration(),
                Boolean.TRUE.equals(d.getIsArchived()), files);
    }

    private LocalDate parseDate(String raw, String label) {
        if (raw == null || raw.isBlank()) return null;
        try {
            LocalDate date = LocalDate.parse(raw.trim());
            if (date.getYear() < 2000 || date.getYear() > 2100) {
                throw new IllegalArgumentException(label + " must be between the years 2000 and 2100.");
            }
            return date;
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(label + " must look like 2026-10-30.");
        }
    }

    private String validateCompany(CompanyRequest r) {
        if (r == null) return "Request body is required.";

        String name = clean(r.name());
        String address = clean(r.address());
        String location = clean(r.location());
        String contact = clean(r.contactNumber());
        String supervisor = clean(r.supervisorName());
        String position = clean(r.supervisorPosition());
        String idType = clean(r.idType());
        String idNumber = clean(r.idNumber());
        String description = r.description() == null ? "" : r.description().trim();

        if (name.isEmpty()) return "Company name is required.";
        if (name.length() > 255) return "Company name is too long (max 255 characters).";
        if (r.natureId() == null) return "Please select the nature of the company.";
        if (address.isEmpty()) return "Address is required.";
        if (address.length() > 255) return "Address is too long (max 255 characters).";
        if (location.length() > 255) return "Location is too long (max 255 characters).";
        if (contact.isEmpty()) return "Contact number is required.";
        if (!PHONE.matcher(contact).matches()) return "Enter a valid contact number.";
        if (supervisor.isEmpty()) return "The immediate supervisor's name is required.";
        if (supervisor.length() > 255) return "The supervisor's name is too long (max 255 characters).";
        if (position.isEmpty()) return "The supervisor's position is required.";
        if (position.length() > 255) return "The supervisor's position is too long (max 255 characters).";
        if (idType.length() > 255 || idNumber.length() > 255) return "The supervisor ID details are too long.";
        if (description.length() > 5000) return "The description is too long (max 5000 characters).";
        return null;
    }

    private void applyCompany(Company company, CompanyRequest r, CompanyNature nature) {
        String description = r.description() == null ? "" : r.description().trim();

        company.setName(clean(r.name()));
        company.setNature(nature);
        company.setAddress(clean(r.address()));
        company.setLocation(emptyToNull(clean(r.location())));
        company.setContactNumber(clean(r.contactNumber()));
        company.setDescription(emptyToNull(description));
        company.setImsupFullname(clean(r.supervisorName()));
        company.setImsupPosition(clean(r.supervisorPosition()));
        company.setImsupCompEvidIdentity(emptyToNull(clean(r.idType())));
        company.setImsupCompEvidIdentityNo(emptyToNull(clean(r.idNumber())));
    }

    private String validateDepartment(DepartmentRequest r) {
        if (r == null) return "Request body is required.";

        String name = clean(r.name());
        String supervisor = clean(r.supervisorFullname());
        String position = clean(r.supervisorPosition());
        String contact = clean(r.supervisorContactNumber());
        String email = clean(r.supervisorEmail());
        String status = r.status() == null ? "" : r.status().trim();

        if (name.isEmpty()) return "Department name is required.";
        if (name.length() > 255) return "Department name is too long (max 255 characters).";
        if (r.slots() == null || r.slots() < 1 || r.slots() > 500) {
            return "Slots must be a number from 1 to 500.";
        }
        if (supervisor.isEmpty()) return "The supervisor's name is required.";
        if (supervisor.length() > 255 || position.length() > 255) {
            return "The supervisor's name or position is too long (max 255 characters).";
        }
        if (!contact.isEmpty() && !PHONE.matcher(contact).matches()) {
            return "Enter a valid supervisor contact number.";
        }
        if (!email.isEmpty() && (email.length() > 255 || !EMAIL.matcher(email).matches())) {
            return "Enter a valid supervisor email.";
        }
        if (!status.isEmpty() && !status.equalsIgnoreCase("APPROVED") && !status.equalsIgnoreCase("PENDING")) {
            return "Status must be APPROVED or PENDING.";
        }

        try {
            LocalDate start = parseDate(r.moaStart(), "MOA start date");
            LocalDate end = parseDate(r.moaExpiration(), "MOA expiration date");
            if (start != null && end != null && end.isBefore(start)) {
                return "The MOA expiration can't be before its start date.";
            }
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
        return null;
    }

    private void applyDepartment(Department d, DepartmentRequest r) {
        LocalDate start = parseDate(r.moaStart(), "MOA start date");
        LocalDate end = parseDate(r.moaExpiration(), "MOA expiration date");
        boolean approved = r.status() != null && r.status().trim().equalsIgnoreCase("APPROVED");

        d.setName(clean(r.name()));
        d.setSlots(r.slots());
        d.setSupervisorFullname(clean(r.supervisorFullname()));
        // Blangkong teksto ang walang laman (hindi null), para hindi mabangga ang NOT NULL sa database
        d.setSupervisorPosition(clean(r.supervisorPosition()));
        d.setSupervisorContactNumber(clean(r.supervisorContactNumber()));
        d.setSupervisorEmail(clean(r.supervisorEmail()).toLowerCase());
        d.setStatus(approved ? "approved" : "pending");
        d.setMoaStart(start == null ? null : start.toString());
        d.setMoaExpiration(end == null ? null : end.toString());
    }
}