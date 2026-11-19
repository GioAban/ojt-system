package com.iodev.practicum.repository;

import com.iodev.practicum.model.Director;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface DirectorRepository extends JpaRepository<Director, Long> {
    Optional<Director> findByEmail(String email);

    boolean existsByEmail(String email);

    /** :email ay naka-trim at lower-case na (AccountEmailService) */
    @Query("select count(d) > 0 from Director d where lower(trim(d.email)) = :email")
    boolean emailInUse(@Param("email") String email);
}
