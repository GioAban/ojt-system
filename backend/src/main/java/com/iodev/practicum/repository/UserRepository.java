package com.iodev.practicum.repository;

import com.iodev.practicum.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, Long id);

    /** :email ay naka-trim at lower-case na (AccountEmailService) */
    @Query("select count(u) > 0 from User u where lower(trim(u.email)) = :email")
    boolean emailInUse(@Param("email") String email);

    @Query("select count(u) > 0 from User u where lower(trim(u.email)) = :email and u.id <> :id")
    boolean emailInUseExcluding(@Param("email") String email, @Param("id") Long id);
}
