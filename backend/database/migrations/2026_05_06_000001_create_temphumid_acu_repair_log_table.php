<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('temphumid')->create('TempHumid_Repair_Downtime_Log', function (Blueprint $table): void {
            $table->id('ID');
            $table->unsignedBigInteger('source_alert_id')->nullable();
            $table->string('machine_id', 255)->nullable();
            $table->string('machine_qr', 255)->nullable();
            $table->string('category_name', 255)->nullable();
            $table->string('description', 255)->nullable();
            $table->string('location', 255)->nullable();
            $table->string('acu_status', 255)->nullable();
            $table->string('processed_by', 255)->nullable();
            $table->string('repair_reason', 255)->nullable();
            $table->text('remarks')->nullable();
            $table->dateTime('processed_at')->nullable();
            $table->string('marked_done_by', 255)->nullable();
            $table->dateTime('marked_done_at')->nullable();
            $table->string('uploaded_by', 255)->nullable();
            $table->dateTime('uploaded_at')->nullable();
            $table->unsignedBigInteger('duration_seconds')->nullable();
            $table->string('status', 255)->nullable();

            $table->index(['machine_id', 'status']);
            $table->index(['status', 'processed_at']);
            $table->index(['status', 'uploaded_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('temphumid')->dropIfExists('TempHumid_Repair_Downtime_Log');
    }
};
