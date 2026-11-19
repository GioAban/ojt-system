package com.iodev.practicum.repository;

import com.iodev.practicum.model.EmailToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EmailTokenRepository extends JpaRepository<EmailToken, Long> {

    Optional<EmailToken> findByTokenHash(String tokenHash);

    /** Isinasara ang lahat ng bukas na link ng isang subject (hal. kapag nag-resend o na-reject) */
    @Modifying
    @Query("update EmailToken t set t.usedAt = :now where t.subjectType = :type and t.subjectId = :id "
            + "and t.purpose = :purpose and t.usedAt is null")
    int closeOpen(@Param("type") String subjectType, @Param("id") Long subjectId,
                  @Param("purpose") String purpose, @Param("now") LocalDateTime now);

    /** Ilang email na ang naipadala sa address na ito mula noong :since (lahat ng registration/account) */
    @Query("select count(t) from EmailToken t where t.email = :email and t.purpose = :purpose and t.createdAt > :since")
    long countSentTo(@Param("email") String email, @Param("purpose") String purpose,
                     @Param("since") LocalDateTime since);

    @Query("select count(t) from EmailToken t where t.subjectType = :type and t.subjectId = :id "
            + "and t.purpose = :purpose and t.createdAt > :since")
    long countSentFor(@Param("type") String subjectType, @Param("id") Long subjectId,
                      @Param("purpose") String purpose, @Param("since") LocalDateTime since);

    /** Para sa "Link sent ..." sa listahan ng coordinator: [subjectId, pinakahuling createdAt] */
    @Query("select t.subjectId, max(t.createdAt) from EmailToken t where t.subjectType = :type "
            + "and t.purpose = :purpose and t.subjectId in :ids group by t.subjectId")
    List<Object[]> lastSentFor(@Param("type") String subjectType, @Param("purpose") String purpose,
                               @Param("ids") Collection<Long> ids);

    @Modifying
    @Query("delete from EmailToken t where t.createdAt < :cutoff")
    int deleteCreatedBefore(@Param("cutoff") LocalDateTime cutoff);
}
