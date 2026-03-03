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
        Schema::create('system_role_defaults', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->integer('priority')->default(0); // Higher = higher priority

            // Audit fields
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->softDeletes();
            $table->string('created_by', 255)->nullable();
            $table->string('updated_by', 255)->nullable();
            $table->string('deleted_by', 255)->nullable();

            // Indexes only (no foreign key to avoid SQL Server cascade issues)
            $table->index('role_id');
            $table->index('priority');
        });

        Schema::create('system_role_default_groups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_default_id');
            $table->integer('sort_order')->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->index('role_default_id');
            $table->index('sort_order');
        });

        Schema::create('system_role_default_conditions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('group_id');
            $table->string('match_field', 50); // 'DEPARTMENT', 'SECTION', 'POSITION', 'DIVISION', etc.
            $table->string('match_value', 255); // Actual value from vw_Users
            $table->integer('sort_order')->default(0);
            $table->string('condition_operator', 10)->default('AND'); // AND / OR between conditions

            $table->index('group_id');
            $table->index(['match_field', 'match_value']);
            $table->index('sort_order');
            $table->index('condition_operator');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_role_default_conditions');
        Schema::dropIfExists('system_role_default_groups');
        Schema::dropIfExists('system_role_defaults');
    }
};
