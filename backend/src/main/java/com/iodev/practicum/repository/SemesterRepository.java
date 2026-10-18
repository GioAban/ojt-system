package com.iodev.practicum.repository;

import com.iodev.practicum.model.Semester;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SemesterRepository extends JpaRepository<Semester, Long> {

    boolean existsBySemesterIgnoreCase(String semester);

    boolean existsBySemesterIgnoreCaseAndIdNot(String semester, Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Semester s set s.isDefault = false where s.isDefault = true")
    int clearDefault();
}