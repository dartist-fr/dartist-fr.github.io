package fr.dartist.widgets

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class WidgetPinnedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return

        val prefs = context.getSharedPreferences(DartistWidgetReceiver.PREFS, Context.MODE_PRIVATE)
        val raw = intent.getStringExtra(EXTRA_CONFIG_JSON)
            ?: prefs.getString(DartistWidgetReceiver.PENDING_CONFIG, null)
            ?: return

        prefs.edit().putString(DartistWidgetReceiver.widgetKey(appWidgetId), raw).apply()

        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val glanceId = GlanceAppWidgetManager(context).getGlanceIdBy(appWidgetId)
                DartistGlanceWidget().update(context, glanceId)
            } catch (_: Exception) {
                // The launcher can remove an app widget before its callback finishes.
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_WIDGET_PINNED = "fr.dartist.widgets.ACTION_WIDGET_PINNED"
        const val EXTRA_CONFIG_JSON = "fr.dartist.widgets.EXTRA_CONFIG_JSON"
    }
}
