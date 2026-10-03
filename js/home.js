/* Home page: live summary and hero carafe */
document.addEventListener('DOMContentLoaded', function () {
  var carafe = App.Carafe(document.getElementById('hero-carafe'));

  function render() {
    var d = App.day(App.todayKey()), drunk = App.total(d), p = drunk / d.target;
    var streak = App.currentStreak(), week = App.range(7);

    carafe.set(p);
    document.getElementById('hero-today').textContent = Math.floor(p * 100) + '%';
    document.getElementById('hero-streak').innerHTML = streak + ' <small>' + (streak === 1 ? 'day' : 'days') + '</small>';
    document.getElementById('hero-avg').innerHTML = week.avg ? App.amtHTML(week.avg) : '–';
    document.getElementById('hero-caption').textContent = drunk
      ? App.amt(drunk) + ' of ' + App.amt(d.target) + ' so far today'
      : 'Nothing logged yet today';

    var hasData = Object.keys(App.state.days).some(function (k) { return App.state.days[k].entries.length; });
    document.getElementById('cta-title').textContent = hasData ? 'Keep the streak going.' : 'Start with your first glass.';
    document.getElementById('cta-text').textContent = hasData
      ? (p >= 1 ? "You've already reached today's target. Nice work."
                : App.amt(Math.max(d.target - drunk, 0)) + ' to go today. Your data stays private in this browser.')
      : 'Everything is stored privately in this browser. No account needed.';
  }

  App.onChange(render);
  render();
});
