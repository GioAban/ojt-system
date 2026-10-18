package com.iodev.practicum.repository;

import com.iodev.practicum.model.Director;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DirectorRepository extends JpaRepository<Director, Long> {
    Optional<Director> findByEmail(String email);

    boolean existsByEmail(String email);
}