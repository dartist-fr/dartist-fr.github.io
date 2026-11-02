package fr.dartist.widgets

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class DartistWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = DartistGlanceWidget()

    companion object {
        const val PREFS = "dartist_widget_configs"
        const val PENDING_CONFIG = "pending_widget_config"
        fun widgetKey(id: Int): String = "widget_$id"
    }
}
