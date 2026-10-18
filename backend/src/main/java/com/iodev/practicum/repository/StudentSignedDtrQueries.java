package com.iodev.practicum.repository;

import com.iodev.practicum.model.SignedDtr;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentSignedDtrQueries extends JpaRepository<SignedDtr, Long> {

    @Query("select s from SignedDtr s join fetch s.monthlyDtr where s.student.id = :studentId")
    List<SignedDtr> findByStudent(@Param("studentId") Long studentId);
}
