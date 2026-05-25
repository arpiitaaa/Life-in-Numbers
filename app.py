import os
import math
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Basic routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json or {}
        
        # Parse and sanitize input data with sensible defaults
        age = float(data.get('age', 25))
        sleep_time = float(data.get('sleep_time', 7))
        screen_time = float(data.get('screen_time', 6))
        social_battery = float(data.get('social_battery', 5)) # 1 to 10
        social_hours = float(data.get('social_hours', 15)) # hours per week
        recharge_method = data.get('recharge_method', 'solitude') # solitude or socializing
        music_genre = data.get('music_genre', 'Synthwave')
        music_hours = float(data.get('music_hours', 2))
        
        # Habits: list of string keys
        # Good: 'exercise', 'meditation', 'reading', 'hydration'
        # Bad: 'smoking', 'junk_food', 'caffeine_late', 'slouching'
        habits = data.get('habits', [])
        
        # 1. LONGEVITY & HEALTH MODEL
        base_lifespan = 80.0
        
        # Sleep modifiers
        sleep_mod = 0.0
        if sleep_time < 7.0:
            sleep_mod = -(7.0 - sleep_time) * 1.8
        elif sleep_time > 9.0:
            sleep_mod = -(sleep_time - 9.0) * 0.8
        else:
            sleep_mod = 1.0  # optimal sleep bonus
            
        # Screen time modifiers (sedentary lifestyle deduction)
        screen_mod = 0.0
        if screen_time > 5.0:
            screen_mod = -(screen_time - 5.0) * 0.5
        elif screen_time < 2.0:
            screen_mod = 0.8  # low screen bonus
            
        # Habit modifiers
        habit_mod = 0.0
        active_good_habits = []
        active_bad_habits = []
        
        habit_impacts = {
            'exercise': 4.5,
            'meditation': 2.0,
            'reading': 1.5,
            'hydration': 1.0,
            'smoking': -10.0,
            'junk_food': -3.5,
            'caffeine_late': -1.0,
            'slouching': -1.2
        }
        
        for habit in habits:
            if habit in habit_impacts:
                impact = habit_impacts[habit]
                habit_mod += impact
                if impact > 0:
                    active_good_habits.append(habit)
                else:
                    active_bad_habits.append(habit)

        # Life expectancy calculation
        expected_lifespan = base_lifespan + sleep_mod + screen_mod + habit_mod
        # Cap expected lifespan between 50 and 100 for safety & realism
        expected_lifespan = max(50.0, min(100.0, expected_lifespan))
        
        remaining_years = max(0.1, expected_lifespan - age)
        
        # Biological Age Model
        # biological age = real age + (life expectancy difference compared to average of 80)
        life_exp_diff = 80.0 - expected_lifespan
        biological_age = age + (life_exp_diff * 0.4) # biological age scales with life choices
        # Limit biological age bounds
        biological_age = max(age * 0.75, min(age * 1.5, biological_age))
        
        # Sleep Debt (annualized)
        sleep_debt_annual = 0.0
        if sleep_time < 8.0:
            sleep_debt_annual = (8.0 - sleep_time) * 365.25 # hours/year
            
        # Cumulative metrics over remaining life
        rem_screen_hours = screen_time * 365.25 * remaining_years
        rem_screen_years = rem_screen_hours / 8766.0 # 24 * 365.25
        
        rem_sleep_hours = sleep_time * 365.25 * remaining_years
        rem_sleep_years = rem_sleep_hours / 8766.0
        
        rem_music_hours = music_hours * 365.25 * remaining_years
        
        # Vitality Score (0-100 scale)
        # Sleep score: max 25
        sleep_score = max(0, min(25, 25 - abs(sleep_time - 7.8) * 6))
        # Screen score: max 25
        screen_score = max(0, min(25, 25 - (screen_time * 2)))
        # Habits score: max 30 (starts at 15)
        good_count = len(active_good_habits)
        bad_count = len(active_bad_habits)
        habits_score = max(0, min(30, 15 + (good_count * 4.5) - (bad_count * 4.5)))
        # Social & mental score: max 20
        # Recharge compatibility: solitude with high hours might drain if they are forced out,
        # or socializing with low hours. Let's make an intuitive score.
        social_alignment = 10.0
        if recharge_method == 'solitude' and social_hours > 30:
            social_alignment -= 4.0 # social exhaustion
        elif recharge_method == 'socializing' and social_hours < 8:
            social_alignment -= 4.0 # under-stimulated
        social_score = max(0, min(20, (social_battery * 1.2) + social_alignment))
        
        vitality_score = int(sleep_score + screen_score + habits_score + social_score)
        vitality_score = max(5, min(100, vitality_score))

        # 2. 24-HOUR ENERGY & CIRCADIAN TIME-SERIES SIMULATION
        # Simulating a typical day from 00:00 to 24:00 at 30-minute intervals (48 steps)
        simulation_data = []
        
        # We assume standard wake time based on sleep hours. 
        # More sleep = wakes up earlier (refreshed) or later. Let's say wakes up at 7:00 AM standard.
        wake_hour = 7.0
        sleep_hour = (wake_hour + (24.0 - sleep_time)) % 24.0
        if sleep_hour < wake_hour:
            # Sleep spans across midnight (normal)
            # Sleep interval: e.g. 23:00 to 07:00
            is_sleep = lambda h: h >= sleep_hour or h < wake_hour
        else:
            # Sleep does not span midnight (e.g. sleep at 01:00 AM, wake at 09:00 AM)
            is_sleep = lambda h: sleep_hour <= h < wake_hour or (h >= sleep_hour or h < wake_hour if wake_hour < sleep_hour else False)
            # Correction for sleep inside day
            is_sleep = lambda h: (h >= sleep_hour) or (h < wake_hour) if sleep_hour > wake_hour else (sleep_hour <= h < wake_hour)

        # Baseline energy levels
        energy = 40.0 # start at midnight
        soc_battery = social_battery * 10.0 # base 0-100
        
        # Define simulation timeline
        for step in range(48):
            hour = step * 0.5
            time_str = f"{int(hour):02d}:{int((hour%1)*60):02d}"
            
            # Is user sleeping at this hour?
            user_sleeping = False
            if sleep_hour > wake_hour:
                if hour >= sleep_hour or hour < wake_hour:
                    user_sleeping = True
            else:
                if sleep_hour <= hour < wake_hour:
                    user_sleeping = True
                    
            # Circadian cycle factor (sine wave peaked at 10 AM and 6 PM)
            circadian = 25.0 * math.sin((hour - 6.0) * (2 * math.pi / 24.0)) + 15.0 * math.sin((hour - 14.0) * (4 * math.pi / 24.0))
            
            if user_sleeping:
                # Recharge physical energy up to 100
                # A full sleep night recharges 100 points
                recharge_rate = 100.0 / max(4.0, sleep_time) # recharge per hour
                energy = min(100.0, energy + recharge_rate * 0.5)
                
                # Recharge social battery slowly during sleep (especially for introverts)
                if recharge_method == 'solitude':
                    soc_battery = min(100.0, soc_battery + 3.0)
                else:
                    soc_battery = min(100.0, soc_battery + 1.5)
                    
                alertness = 5.0 # brain in standby
            else:
                # Waking hours - energy depletes
                # Base decay depends on how long they are awake
                awake_duration = 24.0 - sleep_time
                base_decay = 65.0 / max(8.0, awake_duration) # standard waking decay
                
                # Modifiers
                decay_mod = 1.0
                if screen_time > 7.0:
                    decay_mod += 0.25 # high screen fatigue
                if 'hydration' in habits:
                    decay_mod -= 0.08 # hydration prevents crash
                if 'caffeine_late' in habits and hour >= 16.0:
                    decay_mod -= 0.15 # temporary caffeine block
                    
                energy = max(5.0, energy - (base_decay * decay_mod * 0.5))
                
                # Social battery dynamics during day
                # Assume peak social pressure hours are 9:00 to 18:00 (work/school)
                # and social activities from 18:00 to 21:00
                is_social_peak = (9.0 <= hour <= 17.0) or (18.0 <= hour <= 21.0)
                
                if is_social_peak:
                    if recharge_method == 'solitude':
                        # Socializing drains introverts
                        soc_battery = max(0.0, soc_battery - 3.5)
                    else:
                        # Extroverts get a mild boost or slower drain from social hours
                        soc_battery = min(100.0, soc_battery + 1.0)
                else:
                    # Off-peak hours
                    if recharge_method == 'solitude':
                        soc_battery = min(100.0, soc_battery + 2.5) # recharge in solitude
                    else:
                        soc_battery = max(0.0, soc_battery - 1.5) # gets drained without social input
                
                # Habits action impact during specific times
                # Morning Exercise standard 7:30 to 8:30
                if 'exercise' in habits and (7.5 <= hour <= 8.5):
                    energy = max(15.0, energy - 10.0) # physical exertion drop
                elif 'exercise' in habits and (8.5 < hour <= 16.0):
                    energy = min(100.0, energy + 8.0) # endorphin boost afterwards
                    
                # Evening Meditation standard 18:00 to 18:30
                if 'meditation' in habits and (18.0 <= hour <= 18.5):
                    soc_battery = min(100.0, soc_battery + 15.0)
                    energy = min(100.0, energy + 5.0)
                    
                # Alertness calculation
                # Combines current energy, circadian factor, and screen tiredness
                screen_fatigue = 0.0
                # Screen time is active mostly afternoon and evening
                if screen_time > 4.0 and (13.0 <= hour <= 23.0):
                    screen_fatigue = (screen_time - 4.0) * 1.5
                    
                alertness = (energy * 0.5) + (50.0 + circadian * 0.6) - screen_fatigue
                # Apply caffeine impact
                if 'caffeine_late' in habits and (16.0 <= hour <= 22.0):
                    alertness += 12.0
                alertness = max(10.0, min(100.0, alertness))
                
            simulation_data.append({
                'time': time_str,
                'energy': round(energy, 1),
                'social': round(soc_battery, 1),
                'alertness': round(alertness, 1)
            })

        # 3. FUTURE SELF PROJECTION ENGINE
        # Generate two pathways: Current Path vs. Optimized Path
        milestones = [5, 15, 30] # 5 years, 15 years, 30 years out
        projections = []
        
        music_messages = {
            'Synthwave': "immersed in retro neon soundscapes, cementing a nostalgic focus",
            'Lo-fi': "cocooned in cozy low-fidelity beats, keeping your nervous system grounded",
            'Classical': "resonating with complex orchestral harmonies, bolstering cognitive pathways",
            'Rock': "fueled by energetic riffs, maintaining a high-tempo heartbeat through your tasks",
            'Metal': "channeling chaotic double-bass rhythms to blast through life's stressors",
            'Pop': "pulsing with vibrant, catchy basslines that keep your step light and social energy high",
            'Jazz': "weaving through syncopated improv rhythms, keeping your mind fluid and adaptive"
        }
        
        m_msg = music_messages.get(music_genre, "flowing with your favorite tracks")
        
        for years_out in milestones:
            proj_age = age + years_out
            
            # Cumulative calculations for current path
            c_screen_hours = int(screen_time * 365.25 * years_out)
            c_screen_y = round(c_screen_hours / 8766.0, 1)
            c_sleep_debt = int(sleep_debt_annual * years_out)
            c_books = int((3.0 if 'reading' in habits else 0.5) * years_out)
            c_music_hours = int(music_hours * 365.25 * years_out)
            
            # Cumulative calculations for optimized path (assuming 8h sleep, 2.5h screen, exercise, reading, hydration)
            o_screen_hours = int(2.5 * 365.25 * years_out)
            o_screen_y = round(o_screen_hours / 8766.0, 1)
            o_books = int(12.0 * years_out) # Reads 1 book a month in optimized path
            o_sleep_debt = 0
            
            # Biological age scaling
            c_bio_age = proj_age + (life_exp_diff * 0.4)
            c_bio_age = round(max(proj_age * 0.8, min(proj_age * 1.4, c_bio_age)), 1)
            
            o_bio_age = proj_age - 3.5 # Optimized choices shave off biological years
            o_bio_age = round(max(proj_age * 0.75, o_bio_age), 1)
            
            # Custom narrative prompts
            narrative_current = ""
            narrative_optimized = ""
            
            if years_out == 5:
                narrative_current = f"At age {int(proj_age)}, your current lifestyle has accumulated {c_screen_hours:,} hours ({c_screen_y} solid years) of screen staring. "
                if c_sleep_debt > 500:
                    narrative_current += f"A massive sleep debt of {c_sleep_debt} hours leaves you waking up with a foggy baseline. "
                else:
                    narrative_current += "Your sleep cycle remains stable, but minor fatigues are starting to show. "
                narrative_current += f"You have spent {c_music_hours:,} hours {m_msg}."
                
                narrative_optimized = f"Under your optimized self-transformation, at age {int(proj_age)} your mind is razor-sharp with a biological age of {o_bio_age}. By capping screen time, you reclaimed thousands of hours, allowing you to absorb {o_books} books. You feel light, focused, and wake up fully charged."
                
            elif years_out == 15:
                narrative_current = f"Fifteen years have flown by. At {int(proj_age)}, your biological clock reads {c_bio_age}. "
                if 'smoking' in habits:
                    narrative_current += "The toxic payload of long-term smoking is taking a heavy toll on physical stamina. "
                elif 'junk_food' in habits:
                    narrative_current += "Years of irregular nutritional inputs have left your cellular energy reserves running low. "
                else:
                    narrative_current += "Lack of core strength and minor physical neglect limits your late-afternoon stamina. "
                narrative_current += f"You have dedicated {c_screen_y} full years of continuous life staring at glowing devices."
                
                narrative_optimized = f"At age {int(proj_age)}, you stand in peak physical architecture. Your biological age is a youthful {o_bio_age}. Regular movement and deep cellular hydration mean you have the daily energy of a 20-something, with {o_books} read books fueling your executive leadership."
                
            else: # 30 years
                narrative_current = f"At {int(proj_age)} years old, your timeline converges. On this path, your remaining physical elasticity is compromised. "
                if len(active_bad_habits) >= 2:
                    narrative_current += f"Years of compounding bad habits ({', '.join(active_bad_habits)}) have placed your biological age at {c_bio_age}, causing premature wear."
                else:
                    narrative_current += f"Your biological age registers as {c_bio_age}. While you avoided major crashes, the sedentary drag of screen time has created standard physical limitations."
                
                narrative_optimized = f"At {int(proj_age)}, you are a masterpiece of longevity. With a biological age of {o_bio_age}, your joints are fluid, your mind is highly resilient, and you've enjoyed life on your own terms. Your life expectancy has surged past {int(expected_lifespan + 5.0)} years of high-quality active living."

            projections.append({
                'years_out': years_out,
                'target_age': int(proj_age),
                'current_path': {
                    'bio_age': c_bio_age,
                    'screen_time_years': c_screen_y,
                    'screen_time_hours': c_screen_hours,
                    'sleep_debt_hours': c_sleep_debt,
                    'books_read': c_books,
                    'narrative': narrative_current
                },
                'optimized_path': {
                    'bio_age': o_bio_age,
                    'screen_time_years': o_screen_y,
                    'screen_time_hours': o_screen_hours,
                    'sleep_debt_hours': o_sleep_debt,
                    'books_read': o_books,
                    'narrative': narrative_optimized
                }
            })

        # Return structured analysis response
        return jsonify({
            'success': True,
            'summary': {
                'chronological_age': age,
                'biological_age': round(biological_age, 1),
                'life_expectancy': round(expected_lifespan, 1),
                'remaining_years': round(remaining_years, 1),
                'vitality_score': vitality_score,
                'sleep_debt_annual': round(sleep_debt_annual, 1),
                'remaining_screen_years': round(rem_screen_years, 1),
                'remaining_sleep_years': round(rem_sleep_years, 1),
                'remaining_music_hours': int(rem_music_hours),
                'good_habits_count': len(active_good_habits),
                'bad_habits_count': len(active_bad_habits)
            },
            'simulation': simulation_data,
            'projections': projections
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

if __name__ == '__main__':
    # Running locally on port 5000
    app.run(debug=True, port=5000)
