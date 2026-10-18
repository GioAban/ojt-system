package com.iodev.practicum.repository;

import com.iodev.practicum.model.SignedWeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentSignedWeeklyQueries extends JpaRepository<SignedWeeklyReport, Long> {

    @Query("select s from SignedWeeklyReport s join fetch s.monthlyWeeklyReport where s.student.id = :studentId")
    List<SignedWeeklyReport> findByStudent(@Param("studentId") Long studentId);
}
