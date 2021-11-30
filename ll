DELIMITER $$ 

CREATE PROCEDURE adminRanker()
BEGIN 
  DECLARE done INT DEFAULT 0;
  DECLARE admin_id INT;
  DECLARE admin_process_count INT;
  DECLARE admin_ranking INT default 1;
  DECLARE admin_tier VARCHAR(20);
  DECLARE admin_cur CURSOR FOR SELECT id, num_processed_reports FROM Users WHERE is_admin = 1 ORDER BY num_processed_reports DESC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  
  OPEN admin_cur;
  
  REPEAT FETCH admin_cur INTO admin_id, admin_process_count;
  
  IF admin_process_count < 2 THEN
    SET admin_tier = 'egg';
  ELSEIF admin_process_count < 4 THEN
    SET admin_tier = 'chick';
  ELSEIF admin_process_count < 6 THEN
    SET admin_tier = 'chicken';
  ELSE
    SET admin_tier = 'eagle';
  END IF;
  
  UPDATE Users 
  SET ranking = admin_ranking, tier = admin_tier
  WHERE id = admin_id;

  SET admin_ranking = admin_ranking + 1;
  UNTIL done
  END REPEAT;
  
  close admin_cur;
  END;
  $$

DELIMITER ;