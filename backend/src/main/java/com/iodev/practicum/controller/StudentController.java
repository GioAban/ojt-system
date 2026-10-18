package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentProfileResponse;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/student")
public class StudentController {

    @Autowired
    private StudentRepository studentRepository;

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        Student s = studentRepository.findByEmail(authentication.getName()).orElse(null);
        if (s == null) {
            return ResponseEntity.notFound().build();
        }

        StudentProfileResponse r = new StudentProfileResponse();
        r.setId(s.getId());
        r.setStudentNumber(s.getStudentNumber());
        r.setFirstname(s.getFirstname());
        r.setLastname(s.getLastname());
        r.setMiddleInitial(s.getMiddleInitial());
        r.setEmail(s.getEmail());
        r.setGender(s.getGender());
        r.setContact(s.getContact());
        r.setYear(s.getYear());
        r.setSubjectCode(s.getSubjectCode());
        r.setStatus(s.getStatus());
        r.setDeployedDate(s.getDeployedDate());
        r.setStartTrainingDate(s.getStartTrainingDate());
        r.setCompletedDate(s.getCompletedDate());
        r.setRenderedHours(s.getRenderedHours());
        r.setTrainingDuration(s.getTrainingDuration());
        r.setSemester(s.getSemester().getSemester());
        r.setCoordinatorName(s.getCoordinator().getUser().getFullname());

        if (s.getDepartment() != null) {
            r.setDepartmentName(s.getDepartment().getName());
            r.setCompanyName(s.getDepartment().getCompany().getName());
        }

        return ResponseEntity.ok(r);
    }
}