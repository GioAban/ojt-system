package com.iodev.practicum.service;

import com.iodev.practicum.dto.AssignmentResultResponse;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentDepartmentHistory;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentDepartmentHistoryRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;

/**
 * Pag-assign (o paglipat) ng student sa isang department. Iisang tuntunin para sa Students page
 * at sa mga report: approved na department, may slot pa, parehong semester, hindi archived, at
 * may tala sa kasaysayan ng placement.
 */
@Service
public class PlacementService {

    @Autowired private StudentRepository studentRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentDepartmentHistoryRepository historyRepository;

    /** Resulta ng pagsusuri: ang department, at kung wala namang babaguhin */
    public record Target(Department department, boolean unchanged) {}

    /**
     * Sinusuri kung pwedeng ilipat ang student sa department. Hindi sumusulat.
     * @param incoming ilang student pa ang papasok sa department na ito bago ang isang ito (para sa sabay-sabay na pagsusuri)
     */
    public Target check(Coordinator coordinator, Student student, Long departmentId, int incoming) {
        if (departmentId == null) throw ActionException.bad("Please select a department.");

        Department department = departmentRepository.findById(departmentId).orElse(null);
        // Ang hiling mula sa company link na hindi pa approved ay hindi puwedeng pagtalagahan
        if (department == null || department.getCompany().isHiddenRequest()) {
            throw ActionException.bad("Selected department was not found.");
        }

        Company company = department.getCompany();
        if (!company.getCoordinator().getId().equals(coordinator.getId())) {
            throw ActionException.forbidden("That company doesn't belong to you.");
        }
        if (!company.getSemester().getId().equals(student.getSemester().getId())) {
            throw ActionException.bad("That company belongs to a different semester.");
        }
        if (Boolean.TRUE.equals(company.getIsArchived()) || Boolean.TRUE.equals(department.getIsArchived())) {
            throw ActionException.bad("That company or department is archived.");
        }
        if (!"approved".equalsIgnoreCase(department.getStatus())) {
            throw ActionException.bad("That department isn't approved yet.");
        }

        Department current = student.getDepartment();
        if (current != null && current.getId().equals(department.getId())) {
            return new Target(department, true);
        }

        long filled = 0;
        for (Object[] row : studentRepository.countByDepartmentIds(List.of(department.getId()))) {
            filled = (Long) row[1];
        }
        int slots = department.getSlots() == null ? 0 : department.getSlots();
        if (filled + incoming >= slots) {
            throw ActionException.conflict("This department has no slots left.");
        }
        return new Target(department, false);
    }

    /** Sinusuri at isinusulat ang pag-assign; parehong sagot gaya ng dati ng Students page */
    public AssignmentResultResponse assign(Coordinator coordinator, Student student, Long departmentId) {
        Target target = check(coordinator, student, departmentId, 0);
        Department department = target.department();
        AssignmentResultResponse result = new AssignmentResultResponse(
                department.getId(), department.getName(), department.getCompany().getName());
        if (target.unchanged()) return result; // walang babaguhin

        Timestamp now = new Timestamp(System.currentTimeMillis());
        boolean hadPrevious = student.getDepartment() != null
                || historyRepository.countByStudentId(student.getId()) > 0;

        List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(student.getId());
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
        return result;
    }
}
