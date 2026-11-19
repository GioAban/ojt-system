package com.iodev.practicum.service;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.List;

/**
 * Mga field ng company, department at student na binabago mula sa Company Info at sa mga report.
 * Iisang pagsusuri para sa dalawa. Ang pagmamay-ari (coordinator) ay tinitingnan ng tumatawag.
 */
@Service
public class CompanyInfoService {


    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentRepository studentRepository;

    // ---------------------------------------------------------------------
    // Company: name, address, contactNumber, location
    // ---------------------------------------------------------------------

    public PreparedChange checkCompany(Company company, String field, String raw) {
        String value = clean(raw);
        long affected = countStudents(departmentRepository.findAllByCompanyIds(List.of(company.getId())));

        switch (field == null ? "" : field) {
            case "name" -> {
                if (value.isEmpty()) throw ActionException.bad("Company name is required.");
                if (value.length() > 255) throw ActionException.bad("Company name is too long (max 255 characters).");
                if (companyRepository.nameExistsExcluding(company.getCoordinator().getId(),
                        company.getSemester().getId(), value, company.getId())) {
                    throw ActionException.conflict("You already have a company with that name in this semester.");
                }
                return change("Company name", nz(company.getName()), value, affected,
                        () -> company.setName(value), company);
            }
            case "address" -> {
                if (value.isEmpty()) throw ActionException.bad("Address is required.");
                if (value.length() > 255) throw ActionException.bad("Address is too long (max 255 characters).");
                return change("Company address", nz(company.getAddress()), value, affected,
                        () -> company.setAddress(value), company);
            }
            case "contactNumber" -> {
                // Malayang teksto (puwedeng higit sa isang numero): trim lang, walang format na tseke
                String contact = SupervisorResolver.cleanContact(raw);
                if (contact.isEmpty()) throw ActionException.bad("Contact number is required.");
                if (contact.length() > SupervisorResolver.CONTACT_MAX) throw ActionException.bad(SupervisorResolver.CONTACT_TOO_LONG);
                return change("Company contact number", nz(company.getContactNumber()), contact, affected,
                        () -> company.setContactNumber(contact), company);
            }
            case "location" -> {
                if (value.length() > 255) throw ActionException.bad("Location is too long (max 255 characters).");
                return change("Company location", nz(company.getLocation()), value, affected,
                        () -> company.setLocation(value.isEmpty() ? null : value), company);
            }
            default -> throw ActionException.bad("That field can't be edited here.");
        }
    }

    /**
     * Immediate supervisor ng company (ginagamit kapag walang sariling supervisor ang department ng student).
     * Parehong tuntunin ng company form: opsyonal, pero magkapares ang pangalan at posisyon.
     * @param partner bagong halaga ng kapares na field kung sabay ring binabago; null = ang nasa system
     */
    public PreparedChange checkCompanySupervisor(Company company, String field, String raw, String partner) {
        boolean isName = "supervisorName".equals(field);
        if (!isName && !"supervisorPosition".equals(field)) throw ActionException.bad("That field can't be edited here.");
        String value = SupervisorResolver.clean(raw);
        String other = partner != null
                ? SupervisorResolver.clean(partner)
                : SupervisorResolver.clean(isName ? company.getImsupPosition() : company.getImsupFullname());
        String error = isName
                ? SupervisorResolver.validate(value, other, null, null, "immediate supervisor")
                : SupervisorResolver.validate(other, value, null, null, "immediate supervisor");
        if (error != null) throw ActionException.bad(error);

        long affected = countStudents(departmentRepository.findAllByCompanyIds(List.of(company.getId())));
        String old = SupervisorResolver.clean(isName ? company.getImsupFullname() : company.getImsupPosition());
        String label = isName ? "Immediate supervisor name" : "Immediate supervisor position";
        // Blangkong teksto (hindi null) dahil NOT NULL ang mga column na ito
        return change(label, old, value, affected,
                () -> { if (isName) company.setImsupFullname(value); else company.setImsupPosition(value); }, company);
    }

    // ---------------------------------------------------------------------
    // Department: name, supervisorName, supervisorPosition
    // ---------------------------------------------------------------------

    /**
     * @param partner kapag sabay ring binabago ang kapares na field (pangalan o posisyon ng supervisor),
     *                ang bagong halaga nito; null = ang nasa system
     */
    public PreparedChange checkDepartment(Department department, String field, String raw, String partner) {
        String value = clean(raw);
        long affected = countStudents(List.of(department));

        switch (field == null ? "" : field) {
            case "name" -> {
                if (value.isEmpty()) throw ActionException.bad("Department name is required.");
                if (value.length() > 255) throw ActionException.bad("Department name is too long (max 255 characters).");
                if (departmentRepository.nameExistsInCompanyExcluding(
                        department.getCompany().getId(), value, department.getId())) {
                    throw ActionException.conflict("This company already has a department with that name.");
                }
                return change("Department name", nz(department.getName()), value, affected,
                        () -> department.setName(value), department);
            }
            case "supervisorName" -> {
                // Opsyonal ang supervisor ng department, pero magkapares ang pangalan at posisyon
                String name = SupervisorResolver.clean(value);
                String position = partner != null
                        ? SupervisorResolver.clean(partner)
                        : SupervisorResolver.clean(department.getSupervisorPosition());
                String error = SupervisorResolver.validate(name, position, null, null, "supervisor");
                if (error != null) throw ActionException.bad(error);
                return change("Supervisor name", SupervisorResolver.clean(department.getSupervisorFullname()), name,
                        affected, () -> department.setSupervisorFullname(name), department);
            }
            case "supervisorPosition" -> {
                String position = SupervisorResolver.clean(value);
                String name = partner != null
                        ? SupervisorResolver.clean(partner)
                        : SupervisorResolver.clean(department.getSupervisorFullname());
                String error = SupervisorResolver.validate(name, position, null, null, "supervisor");
                if (error != null) throw ActionException.bad(error);
                // Blangkong teksto ang walang laman, para hindi mabangga ang NOT NULL
                return change("Supervisor position", SupervisorResolver.clean(department.getSupervisorPosition()),
                        position, affected, () -> department.setSupervisorPosition(position), department);
            }
            default -> throw ActionException.bad("That field can't be edited here.");
        }
    }

    // ---------------------------------------------------------------------
    // Student: date started
    // ---------------------------------------------------------------------

    public PreparedChange checkStartDate(Student student, String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        String stored = null;

        if (!trimmed.isEmpty()) {
            try {
                LocalDate date = LocalDate.parse(trimmed);
                if (date.getYear() < 2000 || date.getYear() > 2100) {
                    throw ActionException.bad("Please enter a year between 2000 and 2100.");
                }
                stored = date.toString();
            } catch (DateTimeParseException e) {
                throw ActionException.bad("Date must look like 2026-02-10.");
            }
        }

        String old = student.getStartTrainingDate() == null ? "" : student.getStartTrainingDate().trim();
        String next = stored;
        if (old.equals(next == null ? "" : next)) {
            return new PreparedChange("Start of training", old, old, 1, null);
        }
        return new PreparedChange("Start of training", old, next == null ? "" : next, 1, () -> {
            student.setStartTrainingDate(next);
            studentRepository.save(student);
        });
    }

    /** Ang petsang ipinapakita: start date, o ang deployed date kapag wala */
    public static String startDate(Student s) {
        String raw = s.getStartTrainingDate() != null && !s.getStartTrainingDate().isBlank()
                ? s.getStartTrainingDate()
                : s.getDeployedDate();
        return raw == null || raw.length() < 10 ? null : raw.substring(0, 10);
    }

    // ---------------------------------------------------------------------

    private PreparedChange change(String label, String old, String value, long affected,
                                  Runnable set, Object entity) {
        if (old.equals(value)) return new PreparedChange(label, old, value, affected, null);
        return new PreparedChange(label, old, value, affected, () -> {
            set.run();
            if (entity instanceof Company c) companyRepository.save(c);
            else if (entity instanceof Department d) departmentRepository.save(d);
        });
    }

    public long countStudents(Collection<Department> departments) {
        if (departments.isEmpty()) return 0;

        long total = 0;
        List<Long> ids = departments.stream().map(Department::getId).toList();
        for (Object[] row : studentRepository.countByDepartmentIds(ids)) {
            total += (Long) row[1];
        }
        return total;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }
}
