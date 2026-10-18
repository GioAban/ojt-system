package com.iodev.practicum.repository;

import com.iodev.practicum.model.College;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollegeRepository extends JpaRepository<College, Long> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    boolean existsByAbbreviationIgnoreCase(String abbreviation);

    boolean existsByAbbreviationIgnoreCaseAndIdNot(String abbreviation, Long id);
}