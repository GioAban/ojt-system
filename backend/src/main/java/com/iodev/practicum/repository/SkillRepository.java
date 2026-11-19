package com.iodev.practicum.repository;

import com.iodev.practicum.model.CompanySkill;
import com.iodev.practicum.model.Skill;
import com.iodev.practicum.model.StudentSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findByNormalizedKey(String normalizedKey);

    /** Para sa mungkahi habang nagta-type: ang mga skill na may ganitong bahagi ng key */
    @Query("select s from Skill s where s.normalizedKey like concat('%', :q, '%') order by length(s.normalizedKey), s.name")
    List<Skill> search(@Param("q") String q, org.springframework.data.domain.Pageable page);

    // ---- Mga link (student at company) ----

    @Query("select ss from StudentSkill ss join fetch ss.skill where ss.student.id = :studentId order by ss.id")
    List<StudentSkill> studentSkills(@Param("studentId") Long studentId);

    @Query("select cs from CompanySkill cs join fetch cs.skill where cs.company.id in :companyIds order by cs.id")
    List<CompanySkill> companySkills(@Param("companyIds") Collection<Long> companyIds);

    @Query("select ss from StudentSkill ss where ss.skill.id = :skillId")
    List<StudentSkill> studentLinks(@Param("skillId") Long skillId);

    @Query("select cs from CompanySkill cs where cs.skill.id = :skillId")
    List<CompanySkill> companyLinks(@Param("skillId") Long skillId);

    /** skill id -> ilang student */
    @Query("select ss.skill.id, count(ss) from StudentSkill ss group by ss.skill.id")
    List<Object[]> studentUsage();

    /** skill id -> ilang company */
    @Query("select cs.skill.id, count(cs) from CompanySkill cs group by cs.skill.id")
    List<Object[]> companyUsage();
}
