<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('system_user_roles', function (Blueprint $table) {
            $table->id();
            $table->string('employee_no', 255);
            $table->unsignedBigInteger('role_id');

            // Audit fields
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->softDeletes();
            $table->string('assigned_by', 255)->nullable();
            $table->string('updated_by', 255)->nullable();
            $table->string('deleted_by', 255)->nullable();

            // Prevent duplicate role assignments per user.
            $table->unique(['employee_no', 'role_id']);

            // Index only (no foreign key to avoid SQL Server cascade issues)
            $table->index('employee_no');
            $table->index('role_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_user_roles');
    }
};
