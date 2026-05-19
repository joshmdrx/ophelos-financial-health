considering debt balance in health assessment

- currently only consider surplus ration
- take into account outstanding debt balance when calculating
- find sensible thresholds for healthy

- where does this sit on the data model
- debt model
- for each period check surplus/expense againt outstanding debt for the health assessment
- edge cases: no debt value, no income assessment 

- impacts trend line and current statement

- expected to be part of the statements api with updated assessments
- expect to have new DB model for debt:
    - period (start / end date)
    - amount_minor
    - currency 
    - country_code
    - updated_at
    - created_at
    - deleted_at
