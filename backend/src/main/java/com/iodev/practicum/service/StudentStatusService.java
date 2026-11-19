package com.iodev.practicum.service;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Status ng placement na binabago ng coordinator: For Approval o Approved lang.
 * Ang Deployed ay sa pag-assign ng company, at ang Completed ay sa Complete OJT.
 */
@Service
public class StudentStatusService {

    public static final String FOR_APPROVAL = "For Approval";
    public static final String APPROVED = "Approved";

    @Autowired private StudentRepository studentRepository;

    /** FOR_APPROVAL o APPROVED -> ang iniimbak; null kung iba */
    public static String storedPlacement(String key) {
        String k = key == null ? "" : key.trim().toUpperCase().replace(' ', '_');
        return switch (k) {
            case "FOR_APPROVAL" -> FOR_APPROVAL;
            case "APPROVED" -> APPROVED;
            default -> null;
        };
    }

    /** Dahilan para sa bulk tally (hal. "have completed the OJT"); null kung pwede */
    public String placementSkipReason(Student s) {
        if ("Completed".equalsIgnoreCase(s.getStatus())) return "have completed the OJT";
        if (s.getDepartment() != null) return "are placed in a company (remove them first)";
        return null;
    }

    /** Para sa iisang student (mga report): buong pangungusap ang error */
    public PreparedChange checkPlacement(Student s, String key) {
        String stored = storedPlacement(key);
        if (stored == null) {
            throw ActionException.bad("Use Assign company to deploy students. Status must be FOR_APPROVAL or APPROVED.");
        }
        if ("Completed".equalsIgnoreCase(s.getStatus())) {
            throw ActionException.bad("This student has completed the OJT, so the status can't be changed here.");
        }
        if (s.getDepartment() != null) {
            throw ActionException.bad("This student is placed in a company. Remove the company first on the Students page.");
        }
        String old = s.getStatus() == null ? "" : s.getStatus().trim();
        if (old.equalsIgnoreCase(stored)) return new PreparedChange("Status", old, stored, 1, null);
        return new PreparedChange("Status", old, stored, 1, () -> {
            setPlacement(s, stored);
            studentRepository.save(s);
        });
    }

    /** Ang mismong pagpalit; hindi nagse-save (ang tumatawag ang magse-save, gaya ng bulk) */
    public void setPlacement(Student s, String stored) {
        s.setStatus(stored);
    }
}
