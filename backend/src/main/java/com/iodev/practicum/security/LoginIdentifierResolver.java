package com.iodev.practicum.security;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Ginagawang email ang inilagay sa login box. Kung may "@" ito, email na ito (coordinator, director,
 * o student). Kung wala, Student ID ito at kinukuha ang email ng student na may account.
 * Kapag walang nakita, ibinabalik ang inilagay para ang karaniwang "invalid credentials" ang lumabas.
 */
@Component
public class LoginIdentifierResolver {

    @Autowired private StudentManagementRepository students;

    public String resolveEmail(String identifier) {
        if (identifier == null) return null;
        String value = identifier.trim();
        if (value.isEmpty() || value.contains("@")) return value;

        List<Student> found = students.findLoginCandidates(value);
        return found.isEmpty() ? value : found.get(0).getEmail();
    }
}
