/* Daily Water Intake Tracker – static data */

var WaterData = {
  ML_PER_OZ: 29.5735,
  DEFAULT_TARGET: 2000,
  MIN_TARGET: 500,
  MAX_TARGET: 8000,
  MAX_SERVING: 3000,

  presets: {
    ml: [
      { ml: 150, name: 'Cup' },
      { ml: 250, name: 'Glass' },
      { ml: 350, name: 'Mug' },
      { ml: 500, name: 'Bottle' }
    ],
    oz: [
      { ml: 6 * 29.5735, name: 'Cup' },
      { ml: 8 * 29.5735, name: 'Glass' },
      { ml: 12 * 29.5735, name: 'Mug' },
      { ml: 16 * 29.5735, name: 'Bottle' }
    ]
  },

  // Times of day used by the dashboard's doughnut chart
  periods: [
    { id: 'morning', name: 'Morning', hint: '5 am – 12 pm', from: 5, to: 12, color: '#E9B53F' },
    { id: 'afternoon', name: 'Afternoon', hint: '12 – 5 pm', from: 12, to: 17, color: '#2B9CB8' },
    { id: 'evening', name: 'Evening', hint: '5 – 9 pm', from: 17, to: 21, color: '#14627C' },
    { id: 'night', name: 'Night', hint: '9 pm – 5 am', from: 21, to: 29, color: '#7A6BB0' }
  ],

  achievements: [
    { id: 'first-sip', title: 'First Sip', description: 'Log your first serving', icon: 'drop', type: 'servings', count: 1 },
    { id: 'goal-getter', title: 'Goal Getter', description: 'Reach your daily target for the first time', icon: 'target', type: 'goalDays', count: 1 },
    { id: 'steady', title: 'Steady Sipper', description: 'Log 8 servings in a single day', icon: 'glass', type: 'maxServings', count: 8 },
    { id: 'early-bird', title: 'Early Bird', description: 'Log a serving before 8 am', icon: 'sun', type: 'earlyBird', count: 1 },
    { id: 'all-day', title: 'All Day Long', description: 'Drink in the morning, afternoon and evening of one day', icon: 'clock', type: 'spread', count: 3 },
    { id: 'streak-3', title: 'Three in a Row', description: 'Reach your target 3 days in a row', icon: 'flame', type: 'streak', count: 3 },
    { id: 'streak-7', title: 'Hydrated Week', description: 'Reach your target 7 days in a row', icon: 'flame', type: 'streak', count: 7 },
    { id: 'streak-30', title: 'Hydration Habit', description: 'Reach your target 30 days in a row', icon: 'crown', type: 'streak', count: 30 },
    { id: 'goal-10', title: 'Ten Good Days', description: 'Reach your target on 10 days', icon: 'award', type: 'goalDays', count: 10 },
    { id: 'litres-50', title: 'Fifty Litres', description: 'Log 50 litres in total', icon: 'trophy', type: 'litres', count: 50 }
  ]
};
